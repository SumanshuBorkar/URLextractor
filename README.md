# URLextractor

[async Assignment solution]

## Table of Contents

-   [Getting Started](#getting-started)
    -   [Prerequisites](#prerequisites)
    -   [Installation](#installation)
    -   [Running the Application](#running-the-application)
-   [Environment Variables](#environment-variables)
    -   [Backend (.env in `backend` directory)](#backend-env-backend-directory)
    -   [Frontend (.env in `frontend` directory)](#frontend-env-frontend-directory)
-   [Vector Database Configuration](#vector-database-configuration)
-   [Contributing](#contributing)
-   [License](#license)

## Getting Started

This guide will walk you through setting up and running the project on your local machine.

### Prerequisites

Make sure you have the following installed on your system:

-   **Node.js:** (Specify the minimum required version if necessary, e.g., "version 16 or higher") You can download it from [https://nodejs.org/](https://nodejs.org/).
-   **npm (Node Package Manager):** This comes bundled with Node.js. You can check your version by running `npm -v` in your terminal.
-   **Git:** Required for cloning the repository. You can download it from [https://git-scm.com/](https://git-scm.com/).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <your-repository-name>
    ```

2.  **Navigate to the backend directory and install dependencies:**
    ```bash
    cd backend
    npm install
    ```

3.  **Navigate to the frontend directory and install dependencies:**
    ```bash
    cd ../frontend
    npm install
    ```

### Running the Application

1.  **Start the backend server:**
    ```bash
    cd backend
    node app.js
    ```
    (The backend server should now be running, likely on a specified port. Check your backend logs for confirmation.)

2.  **Start the frontend development server:**
    Open a **new** terminal window or tab and navigate to the frontend directory:
    ```bash
    cd ../frontend
    npm start
    ```
    (The frontend application will usually open in your web browser at a specific address, often `http://localhost:3000`.)

## Environment Variables

You will need to configure environment variables for both the backend and the frontend. Create `.env` files in the respective directories.

### Backend (.env in `backend` directory)
# Server configuration

PORT=3000
LOG_LEVEL=debug


# Search configuration
USE_VECTOR_SEARCH=false
