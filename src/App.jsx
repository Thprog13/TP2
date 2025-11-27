// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import TeacherDashboard from "./teacher/TeacherDashboard.jsx";
import CoordoDashboard from "./coordo/CoordoDashboard.jsx"; // <--- Import

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard-teacher" element={<TeacherDashboard />} />
      <Route path="/dashboard-coordo" element={<CoordoDashboard />} />
    </Routes>
  );
}
