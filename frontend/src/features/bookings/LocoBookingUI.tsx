import { useState, useEffect } from "react";
import { Train } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import "./LocoBooking.css";

interface Loco {
  loco_number: number;
  loco_type_id: number;
}

interface Job {
  job_id: number;
  job_description: string;
}

interface Task {
  task_id: number;
  task_description: string;
}

const LocoBookingUI = () => {
  const [locos, setLocos] = useState<Loco[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [selectedLoco, setSelectedLoco] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedTask, setSelectedTask] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locosRes, jobsRes, tasksRes] = await Promise.all([
          api.get("/locos/"),
          api.get("/jobs/"),
          api.get("/jobs/tasks"),
        ]);
        setLocos(locosRes.data);
        setJobs(jobsRes.data);
        setTasks(tasksRes.data);
      } catch (error) {
        console.error("Error fetching booking data", error);
      }
    };
    fetchData();
  }, []);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await api.post("/bookings/", {
        loco_number: parseInt(selectedLoco),
        job_id: parseInt(selectedJob),
        task_id: parseInt(selectedTask),
        date_time: new Date().toISOString(),
      });
      setMessage("Booking successful!");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setMessage(
          "Booking failed: " +
            (error.response?.data?.detail || "Unknown error"),
        );
      } else {
        setMessage("Booking failed: An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-container">
      <div className="booking-card">
        <div className="booking-header">
          <Train size={24} className="text-blue-600" />
          <h2>New Loco Booking</h2>
        </div>

        <form onSubmit={handleBooking} className="booking-form">
          {message && (
            <div
              className={`message ${message.includes("failed") ? "error" : "success"}`}
            >
              {message}
            </div>
          )}

          <div className="form-group">
            <label>Select Locomotive</label>
            <select
              value={selectedLoco}
              onChange={(e) => setSelectedLoco(e.target.value)}
              required
            >
              <option value="">-- Choose Loco --</option>
              {locos.map((l) => (
                <option key={l.loco_number} value={l.loco_number}>
                  Loco #{l.loco_number}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Select Job</label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              required
            >
              <option value="">-- Choose Job --</option>
              {jobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>
                  {j.job_description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Select Task</label>
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              required
            >
              <option value="">-- Choose Task --</option>
              {tasks.map((t) => (
                <option key={t.task_id} value={t.task_id}>
                  {t.task_description}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-book" disabled={loading}>
            {loading ? "Processing..." : "Confirm Booking"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LocoBookingUI;
