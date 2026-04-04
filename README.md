# Online Examination Portal

Full-stack examination portal with role-based dashboards for students, teachers, and admins. Students can take exams, view results, request retests, and see section rankings. Teachers manage exams, questions, materials, student results, and section rank boards. System admins review password change and retest requests.

## Features
Student
- Register and login with section
- Take exams with timer and auto-submit
- View results with accuracy and performance charts
- Request retests after due dates
- View admin feedback and section rank board

Teacher
- Create exams and batch-add questions
- Edit exams and request edit permissions
- Upload and manage materials
- View student results by section
- View section rank board for students in chosen section

Admin (System)
- Approve or reject password change/forgot requests
- Approve or reject retest requests
- Review teacher edit requests
- Delete exams with notes
- View feedback sent to users

## Tech Stack
- Backend: Node.js, Express, MongoDB, Mongoose, JWT
- Frontend: React (Vite)
- Styling: Custom CSS

## Project Structure
- `server.js` Express app entry
- `routes/` API routes
- `models/` Mongoose schemas
- `client/` React frontend
- `public/` Static fallback pages
- `uploads/` Uploaded materials

## Environment Variables
Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
```

Optional frontend env:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Installation
```bash
npm install
npm run client:install
```

## Running the App (Development)
```bash
npm run dev
```

This starts:
- Backend at `http://localhost:5000`
- Frontend at `http://localhost:5173` (Vite default)

## Build for Production
```bash
npm run prod:build
npm start
```

When a frontend build is present, the server serves the React app from `client/dist`.

## API Overview
Auth and Users
- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/change-password`
- `POST /api/users/forgot-password-request`
- `GET /api/users/change-password/status`
- `GET /api/users/password-change-requests` (admin)
- `POST /api/users/password-change-requests/:userId/review` (admin)
- `GET /api/users/admin-feedback`
- `POST /api/users/admin-feedback/mark-viewed`

Exams and Questions
- `POST /api/exams` (teacher)
- `GET /api/exams`
- `GET /api/exams/mine` (teacher)
- `PUT /api/exams/:id` (teacher/admin)
- `DELETE /api/exams/:id` (admin)
- `POST /api/questions/bulk` (teacher)
- `GET /api/questions/:examId`
- `GET /api/questions/manage/:examId` (teacher)
- `PUT /api/questions/bulk-update` (teacher)

Results and Rankings
- `POST /api/results/submit` (student)
- `GET /api/results` (student)
- `GET /api/results/students?section=SECTION` (teacher)
- `GET /api/results/student/:userId?section=SECTION` (teacher)
- `GET /api/results/rankings` (student)
- `GET /api/results/rankings/section?section=SECTION` (teacher)
- `POST /api/results/retest-requests` (student)
- `GET /api/results/retest-status` (student)
- `GET /api/results/retest-requests` (admin)
- `POST /api/results/retest-requests/:id/review` (admin)

Materials
- `POST /api/materials` (teacher/admin)
- `POST /api/materials/upload` (teacher/admin)
- `GET /api/materials`
- `DELETE /api/materials/:id` (teacher/admin)

## Notes
- Students are required to have a `section`.
- Rank boards are calculated using each student’s best score per exam in the selected section.
- Teachers only see rankings for exams they created.
