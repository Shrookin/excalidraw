# Persistent collaboration with SpacetimeDB

## Current Excalidraw sharing flow

Excalidraw currently has two relevant sharing paths ([app implementation](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/collab/Collab.tsx), [Firebase scene storage](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/data/firebase.ts), [encryption helpers](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/encryption.ts)):

- A shareable link exports a scene snapshot to the JSON backend. The link opens that saved scene for viewing or copying; it is not the same as a shared document with durable edits.
- A collaboration link contains a room ID and a decryption key in the URL fragment. The app connects to the Excalidraw Room Socket.IO server for live broadcasts and stores encrypted scene snapshots and image files in Firebase. The fragment key is used client-side, so the room service can relay ciphertext without reading the drawing.

The important distinction is that a collaboration link is already durable: the initiating browser does not host the room. The app creates a room ID and key, opens a Socket.IO connection for active editors, and writes encrypted scene snapshots to Firebase. Reopening that same collaboration link later loads the saved scene. The initiating browser can close; the hosted room service and database remain available. Starting collaboration again without the old link creates a new room, and the app does not provide a document library or membership management. The [current room code](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/collab/Collab.tsx) and [scene persistence code](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/data/firebase.ts) show this split.

The JSON shareable link is a separate, read-only snapshot flow. For Google Docs-style editing, collaborators need the collaboration link, not the readonly snapshot link.

## Do we need a Raspberry Pi or a new backend?

No. A Raspberry Pi is not needed to keep an editor session alive. The editor's WebSocket connection exists only while somebody has the drawing open; Firebase keeps the latest encrypted snapshot when everyone is gone. The server components are already hosted by Excalidraw. The simplest Google Docs-style product is therefore to make the existing collaboration URL a stable document link and make reopening it the normal edit flow, rather than starting a fresh room each time.

SpacetimeDB could replace or consolidate the room-state backend, but it is not required to get asynchronous edits. Its managed Maincloud service handles hosting and can suspend idle databases on its free tier, preserving data and resuming on the next request; paid tiers can keep databases running. A self-hosted Raspberry Pi would be an option for local control, but then power, internet reachability, backups, patching, and availability become your responsibility. [Maincloud deployment and lifecycle](https://spacetimedb.com/docs/how-to/deploy/maincloud/)

## Can SpacetimeDB support the desired flow?

Yes. A SpacetimeDB document row can remain in durable storage when no clients are connected. A client can reconnect later, subscribe to that document's state, read the current scene, and submit edits through reducers. Reducers are transactional, and subscriptions deliver incremental changes into a local client cache ([persistence and subscriptions](https://spacetimedb.com/docs/intro/faq/), [access permissions](https://spacetimedb.com/docs/tables/access-permissions/)). This removes the need for an editor to host a live session, just as Excalidraw's existing hosted persistence already does.

SpacetimeDB provides transport, durable state, subscriptions, and server-side validation; it does not by itself solve Excalidraw's concurrent scene-merge rules. That merge policy must be implemented explicitly.

## Suggested first architecture

1. Create a durable `Document` record with an opaque ID, encrypted scene payload, monotonically increasing revision, timestamps, and an optional name.
2. Keep the encryption key client-side in the URL fragment, following the current link model. Store ciphertext in SpacetimeDB so the service cannot read drawing contents. A document ID alone must not grant access.
3. Use a reducer for document creation and edit commits. Each commit includes the expected revision. The reducer validates authorization, rejects stale revisions, and atomically stores the new ciphertext and revision.
4. Subscribe to the selected document while it is open. Users can open it hours or days apart; they receive the latest durable version without any other editor being online.
5. For version conflicts, start with a bounded retry: fetch the latest encrypted scene, decrypt locally, reconcile element versions, then retry against the new revision. If this loses concurrent edits in practice, introduce a CRDT or operation log rather than treating database subscriptions as conflict resolution.
6. Keep large image blobs in object storage and store encrypted references in the scene/document. Avoid sending every pointer movement through durable storage; cursors and presence can remain ephemeral.

## Access and privacy choices

There are two viable product modes:

- **Capability link:** anyone holding the secret fragment key may edit. This keeps the friction low and approximates current room-link access. Revocation requires rotating the capability/key or copying the document.
- **Account-backed document:** authenticate users with OIDC, store document membership, and validate every read and write against membership. Share links grant read/edit roles or invite users. This supports revocation and a document library, but adds sign-in and account lifecycle work.

SpacetimeDB tables are private by default; clients read exposed data through public tables or views and change data through reducers. For account-backed documents, keep membership checks in server-side views/reducers. For capability links, use high-entropy secrets and server-side verification; do not expose an unfiltered index of every document. End-to-end encryption still matters even when access control is enforced by the database.

## Phased implementation

1. Prototype a standalone SpacetimeDB TypeScript module with document creation, encrypted snapshot commits, revision checks, and subscriptions.
2. Add a client adapter behind a feature flag. Keep Socket.IO only for ephemeral cursor/presence while validating snapshot persistence and reconnect behavior.
3. Test edits from independent browser profiles with the first profile fully closed before the second opens the document. Include stale-write, offline reconnect, authorization, encryption, image, and export cases.
4. Decide whether reducer conflicts are acceptable or whether edits need a CRDT/operation log before replacing the existing room broadcast path.
5. Only after that evidence, plan account-backed sharing, invitations, revocation, and hosted deployment.

## Main risks and unknowns

- Whole-scene snapshot writes can conflict when editors change separate elements at the same time. Database transactionality prevents partial writes; it does not merge those edits.
- Per-element update rows may reduce conflicts but require defining deletion, ordering, undo/redo, and schema migration semantics.
- A public collaboration product needs rate limits, abuse controls, quotas, document deletion, backup/export, and a clear retention policy.
- End-to-end encryption protects content from the database operator but complicates server-side search, previews, moderation, and user recovery.
- SpacetimeDB Cloud deployment, operating cost, file-size limits, and retention requirements should be checked against the target scale before choosing it over Firebase or a conventional database.

## Recommendation

This fork starts the Google Docs-style flow on Excalidraw's current backend: the share dialog calls the operation “Create edit link,” labels the result as a shared drawing, and explains that the same link can be reopened after leaving. A document list or account-backed ownership could be added later if users need to recover links they lose.

The next acceptance check is to open the link in a second browser after closing the first browser, then make another edit and confirm it saves and syncs. Consider a SpacetimeDB prototype only if we want its unified state/subscription model or need to own the backend. Keep Excalidraw's scene reconciliation and ephemeral cursor/presence behavior explicit in that design. The database's durable transactions alone do not resolve simultaneous edits.
