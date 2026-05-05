# SyncBoard - Your ideas, in sync

<p align="center">
  <img alt="syncboard-logo" src="https://github.com/user-attachments/assets/1512dc5c-41df-4aec-91c9-1fc365c908a9" width="200" height="200">
</p>

## Project overview

**SyncBoard** is a real-time collaborative digital whiteboard designed for teams that want to draw, plan, and brainstorm with zero latency. 

Developed as a comprehensive university project, the application combines a clean user interface with a highly optimized backend infrastructure. It is built to ensure maximum fluidity and performance during simultaneous collaboration among multiple users.

## Core features

### Advanced drawing tools
* **Freehand & highlighting**: fluid pen tool featuring automatic curve smoothing, including a highlighter employing multiply blend mode to ensure realistic color merging.
* **Geometric shapes**: native support for lines, rectangles, circles, and triangles.
* **Vector manipulation**: a dynamic lasso tool for single or multiple shape selections, supporting translation, rotation, and proportional resizing of elements.
* **Edit history**: a robust undo/redo system tracking past operations, seamlessly integrated with the network engine to revert or restore shared actions across the network.

### Real-time collaboration
* **Live cursors**: smooth, real-time rendering of other users' cursors on the canvas.
* **Live chat**: built-in text chat within each board for contextual communication.
* **Flexible sharing**: granular access control allowing permanent sharing with specific users, or temporary sharing via unique invite links configured with read-only (*viewer*) or edit (*editor*) permissions.

### Workspace management & UX
* **Organized dashboard**: a file system-like dashboard allowing the creation of nested folders to keep projects organized, complete with drag & drop functionality.
* **Export capabilities**: instantly export the whiteboard to a high-resolution PNG image or a PDF document.
* **Touch & stylus support**: built-in gesture support for mobile devices and tablets, carefully separating stylus input (drawing) from touch input (two-finger pinch-to-zoom and canvas pan toggle).

## Technical optimizations

**SyncBoard** goes beyond standard WebSocket data transmission by adopting advanced **optimization** techniques to minimize bandwidth consumption and database load:

### 1. Binary cursor encoding (`ArrayBuffer` & `DataView`)
Instead of transmitting heavy _JSON_ payloads at 60 frames per second for every active cursor, (x, y) positions and user identifiers are serialized into a custom binary format. This drastically reduces network overhead, allowing smooth synchronization of dozens of users without causing bandwidth bottlenecks.

### 2. Database write-batching & deduplication
Drawing operations on a canvas generate a massive amount of events (inserts/deletes). To prevent overloading the MongoDB instance, the backend utilizes an in-memory buffer that aggregates and deduplicates operations, executing a highly efficient `bulkWrite` every _500ms_ per active room.

### 3. Custom collision detection & bounding-box rotation and resize logic
Collision detection for the lasso selection (done via polygon ray-casting) and affine transformations of points (for rotations and scalar resizing) are handled entirely through optimized mathematical vector logic on the client side. This offloads external frameworks and ensures instantaneous rendering on `react-konva`.

### 4. Viewport culling
Cursors located outside a user's visible area (viewport) are filtered and therefore not transmitted, saving further computational power and rendering overhead on the frontend.

## Architecture & employed libraries/technologies

The project is built on the **MERN** stack (MongoDB, Express, React, Node.js), carefully enhanced for real-time interactions:

**Frontend (client):**
* **React 19** (Vite)
* **TailwindCSS v4** (Utility-first styling)
* **Konva.js & react-konva** (HTML5 canvas rendering engine)
* **Socket.io-client** (Persistent bidirectional connection)

**Backend (server):**
* **Node.js & Express.js**
* **MongoDB & Mongoose** (Data persistence and relational mapping)
* **Socket.io** (Room management and event broadcasting)
* **JWT (JSON Web Tokens) & Bcrypt** (Stateless authentication and security)

## Contributors
Project developed by _Fabio Pastore_ and _Alessandro Zannone_ for the course "Tecnologie e sistemi web" @ **Sapienza University of Rome** during my 3rd year of studies in Computer Engineering (BSc).
