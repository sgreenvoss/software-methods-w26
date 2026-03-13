# software-methods-w26

Please visit our website at: https://socialscheduler.me/.

Due to Google Oauth restrictions, you must send one of the developers 
the email address(es) of the account(s) you wish to use to authenticate in the website.
The team will add your account as a tester so that you can enter your account. 

Publishing the website with Google Oauth is a lengthy process. Unfortunately, DAGS was unable 
to go through this process by the due date of the project.

To remove permissions given to the app, you can go to your Google account settings ->
Third-party apps & services -> Scheduler Demo -> Delete all connections you have with Scheduler Demo.

===============================================

To Run a Local Instance:

## Tech Stack
* **Frontend:** React (Create React App / Vite)
* **Backend:** Node.js, Express
* **Database:** PostgreSQL

---

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
1. [Node.js](https://nodejs.org/) (v16.0 or higher recommended)
2. [PostgreSQL](https://www.postgresql.org/download/) (running locally or via a cloud provider)

---

## Step-by-Step Setup

### 1. Install Dependencies
You will need to install the Node packages for both the backend server and the frontend client.

Install backend dependencies (Express, pg, cors, dotenv, etc.)

Navigate to the frontend directory and install React dependencies

### 2. Set Up the Database
This app relies on a PostgreSQL relational database.

1. Open your PostgreSQL terminal (psql) or a GUI tool like pgAdmin/DBeaver.

2. Create a new database for the project:

3. Run your schema generation scripts to create the required tables (e.g., users, calendar, cal_event, groups).

### 3. Configure Environment Variables
The application uses environment variables to securely connect to the database and manage API routing.

Create a file named .env.development in the root directory of your backend server, and add the following template:

# --- .env.development ---

GOOGLE_CLIENT_ID = 
GOOGLE_CLIENT_SECRET = 
GOOGLE_REDIRECT_URI = 
SESSION_SECRET = 
PORT = 

DATABASE_URL=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
DB_NAME=


NODE_ENV=development
FRONTEND_URL=
BACKEND_URL=

RESEND_API_KEY=

# Build the frontend
npm run build

# Start the Backend
npm run dev

