Task Manager API
A production-ready RESTful Task Manager API built with NestJS, MongoDB, and JWT Authentication. This project allows users to securely manage tasks, organize them into categories, receive reminder notifications, and provides administrative features such as user and activity management.
________________________________________
Features

Authentication
•	User registration
•	User login
•	JWT authentication
•	Refresh token support
•	Password hashing using bcrypt

Task Management
•	Create, update, delete and retrieve tasks
•	Assign task priority
•	Track task status
•	Set due dates
•	Search tasks
•	Filter tasks by status
•	Pagination
•	Sorting
•	User-specific task ownership

Categories
•	Create categories
•	Update categories
•	Delete categories
•	Retrieve user categories

Activity Logs
•	Automatically records important user actions
•	Admin-only access to activity history

User Management
•	View all users (Admin only)
•	Delete users (Admin only)

Notifications
•	Scheduled reminder jobs using Cron
•	WebSocket notifications for real-time task updates

Health Monitoring
•	MongoDB health check using NestJS Terminus

API Documentation
•	Interactive Swagger documentation available at:
/api/docs
________________________________________
Tech Stack
•	NestJS
•	Node.js
•	MongoDB
•	Mongoose
•	Passport JWT
•	bcrypt
•	Swagger
•	WebSockets (Socket.IO)
•	NestJS Schedule (Cron Jobs)
•	Docker
•	Jest
•	GitHub Actions
________________________________________
Project Structure
src
├── activity
├── auth
├── categories
├── common
├── config
├── health
├── tasks
├── users
├── websocket
├── app.module.ts
└── main.ts
________________________________________
Installation
Clone the repository
git clone < https://github.com/sherazerjaved-cpu/Task-Manager-Api>
Navigate into the project
cd task-manager-api
Install dependencies
npm install
________________________________________
Environment Variables
Create a .env file in the project root.
Example:
PORT=3000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

JWT_EXPIRES_IN=15m

JWT_REFRESH_SECRET=your_refresh_secret

JWT_REFRESH_EXPIRES_IN=7d

REMINDER_CRON=*/30 * * * * *
________________________________________
Running the Application
Development
npm run start:dev
Production
npm run build
npm run start:prod
________________________________________
Running with Docker
docker compose up --build
________________________________________
Swagger Documentation
Once the application is running, open:
http://localhost:3000/api/docs
Swagger provides:
•	API documentation
•	Request/response schemas
•	JWT authorization
•	Interactive endpoint testing
________________________________________
Authentication
Authenticate using:
POST /api/v1/auth/login
Copy the returned access token.
In Swagger:
1.	Click Authorize
2.	Paste the JWT token
3.	Execute protected endpoints
________________________________________
API Endpoints
Authentication
Method	Endpoint
POST	/api/v1/auth/register
POST	/api/v1/auth/login
POST	/api/v1/auth/refresh
________________________________________
Tasks
Method	Endpoint
GET	/api/v1/tasks
GET	/api/v1/tasks/:id
POST	/api/v1/tasks
PATCH	/api/v1/tasks/:id
DELETE	/api/v1/tasks/:id
________________________________________
Categories
Method	Endpoint
GET	/api/v1/categories
GET	/api/v1/categories/:id
POST	/api/v1/categories
PATCH	/api/v1/categories/:id
DELETE	/api/v1/categories/:id
________________________________________
Users (Admin)
Method	Endpoint
GET	/api/v1/users
DELETE	/api/v1/users/:id
________________________________________
Activity (Admin)
Method	Endpoint
GET	/api/v1/activity
________________________________________
Health
Method	Endpoint
GET	/api/v1/health
________________________________________
Testing
Run unit tests
npm run test
Run end-to-end tests
npm run test:e2e
Run test coverage
npm run test:cov
Run linting
npm run lint
________________________________________
Postman Collection
A Postman collection is included with the repository containing:
•	Authentication requests
•	Refresh token flow
•	Task endpoints
•	Category endpoints
•	Activity endpoints
•	User endpoints
•	Health endpoint
________________________________________
Assignment Features Completed
•	JWT Authentication
•	Refresh Tokens
•	Role-Based Authorization
•	CRUD Operations
•	Categories
•	Activity Logging
•	Pagination
•	Filtering
•	Searching
•	Sorting
•	WebSockets
•	Scheduled Reminder Jobs
•	Swagger Documentation
•	Docker Support
•	GitHub Actions
•	Health Checks
•	Unit & E2E Tests
________________________________________
Author
# Author

**Sherazer Javed**

Backend Developer | NestJS | Node.js | MongoDB
