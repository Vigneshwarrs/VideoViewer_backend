# VideoViewer Backend

## Introduction

This repository contains the backend for a comprehensive video management and analytics platform. It is a Node.js application that handles user authentication, CRUD operations for cameras, real-time video streaming via WebSockets, and a custom data pipeline for analytics. The backend serves as the core engine that connects the frontend with various databases and a messaging system to create a secure, scalable, and data-rich application.

## Features

- **User Authentication:** Implements a robust login system with **JSON Web Tokens (JWT)** for secure, role-based access control.
- **RESTful API:** Provides a set of well-defined API endpoints for managing camera data, including creating, reading, updating, and deleting camera entries.
- **Real-time Video Streaming:** Utilizes **WebSockets** to stream video content from stored files to the frontend in a highly efficient manner.
- **Custom Data Pipeline:** Acts as the central hub for a complex data flow, logging user actions and events for later analysis.
- **File Management:** Handles the upload and storage of video files associated with each camera.

## Technologies Used

### Backend
* **Node.js (Express):** The server environment for building the API, routing requests, and managing middleware.
* **Socket.IO:** The library used for establishing and managing real-time WebSocket connections for the video stream.

### Databases & Cache
* **MongoDB:** The primary NoSQL database for storing user accounts and camera details.
* **PostgreSQL with TimescaleDB:** A powerful relational database that is optimized for storing and querying time-series data for the analytics dashboard.
* **Redis:** An in-memory data store used as a high-performance cache to quickly retrieve camera information and reduce load on the primary database.

### Messaging
* **MQTT:** A lightweight messaging protocol used as a message bus to publish events related to user actions (e.g., login, CRUD operations, video playback) for the analytics pipeline.

## Project Architecture & Data Flow



1.  **Frontend Communication:** The backend receives both REST API calls for CRUD operations and real-time WebSocket messages for video streaming.
2.  **Database Interactions:**
    * CRUD operations result in data being saved to **MongoDB**.
    * Updated camera data is simultaneously cached in **Redis** for faster access.
3.  **Analytics Pipeline:** The backend publishes events to an **MQTT** topic every time a user performs an action (e.g., login, adding a camera, playing a video). A separate consumer service (Node-RED, as per the assignment description) subscribes to these topics.
4.  **Video Stream:** When a user requests to play a video, the backend uses `fs.createReadStream` to read the video file in `ArrayBuffer` chunks, which are then sent to the frontend over a dedicated WebSocket connection.

## Getting Started

Follow these steps to get the project up and running on your local machine.

### Prerequisites

* Node.js (v18 or higher)
* npm
* MongoDB
* Redis
* PostgreSQL with TimescaleDB extension
* MQTT Broker (e.g., Mosquitto)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/Vigneshwarrs/VideoViewer_backend.git](https://github.com/Vigneshwarrs/VideoViewer_backend.git)
    cd VideoViewer_backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    Create a `.env` file in the root directory based on the provided `.env` file. This file will store your database connection strings, JWT secret, and other configuration settings.

4.  **Run the application:**
    ```bash
    npm start
    ```
    This will start the Node.js server, which will be ready to handle API requests and WebSocket connections.

---
### Author
Vigneshwarrs
---
