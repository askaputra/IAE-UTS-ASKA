'use client';

import { useState, useEffect, SetStateAction } from 'react';
import { useQuery, useMutation, gql, useSubscription } from '@apollo/client';
import { authApi } from '@/lib/api';

// 1. GRAPHQL QUERIES
const GET_TASKS = gql`
  query GetTasks($teamId: ID!) {
    tasks(teamId: $teamId) {
      id
      title
      description
      status
      assignedToId
      createdAt
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($title: String!, $description: String, $teamId: ID!) {
    createTask(title: $title, description: $description, teamId: $teamId) {
      id
      title
      status
    }
  }
`;

const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($id: ID!, $status: TaskStatus!) {
    updateTaskStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

// MUTASI BARU
const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

const TASK_SUBSCRIPTION = gql`
  subscription OnNotificationAdded($teamId: ID!) {
    notificationAdded(teamId: $teamId) {
      id
      message
      task {
        id
        title
        status
      }
    }
  }
`;

// 2. Tipe Data (DIPERBARUI)
type Task = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'inprogress' | 'done';
};
// Tambahkan 'role'
type User = { id: string; name: string; email: string; teamId: string; role: string };
type Notification = { id: string; message: string };


// 3. KOMPONEN UTAMA (DIPERBARUI)
export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('jwt_token');
    const storedUser = localStorage.getItem('user_data');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser)); // User object sekarang berisi 'role'
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    setToken(null);
    setUser(null);
    window.location.reload(); 
  };

  if (!token || !user) {
    return <AuthPage setToken={setToken} setUser={setUser} />;
  }

  if (!user.teamId) {
    return <JoinTeamPage user={user} onTeamJoined={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Task Board</h1>
        <div>
          <span className="text-gray-700 mr-4">
            Welcome, {user.name} 
            {/* Tampilkan peran user */}
            <span className="font-semibold text-blue-600"> ({user.role})</span>
          </span>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>
      {/* Kirim user object ke TaskBoard */}
      <TaskBoard user={user} />
    </div>
  );
}

// 4. KOMPONEN AUTENTIKASI (Sama seperti sebelumnya, tidak perlu diubah)
function AuthPage({ setToken, setUser }: { setToken: (token: string) => void, setUser: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isLogin) {
        const response = await authApi.login({ email, password });
        const { token, user } = response.data;
        localStorage.setItem('jwt_token', token);
        localStorage.setItem('user_data', JSON.stringify(user));
        setToken(token);
        setUser(user);
      } else {
        await authApi.register({ name, email, password });
        setSuccess('Registration successful! Please log in.');
        setIsLogin(true);
        setName('');
        setEmail('');
        setPassword('');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || (isLogin ? 'Login failed' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded-lg">
        <div className="flex border-b mb-6">
          <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 font-semibold ${isLogin ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>Login</button>
          <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 font-semibold ${!isLogin ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>Register</button>
        </div>
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-6">{isLogin ? 'Login' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (<input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-md px-3 py-2" required />)}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          {success && <p className="text-green-500 text-sm text-center">{success}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400">{loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}</button>
        </form>
      </div>
    </div>
  );
}

// 5. KOMPONEN PAPAN TUGAS (DIPERBARUI)
function TaskBoard({ user }: { user: User }) {
  const { teamId } = user;
  const { data, loading, error, refetch } = useQuery(GET_TASKS, { 
    variables: { teamId },
    fetchPolicy: 'network-only'
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useSubscription(TASK_SUBSCRIPTION, {
    variables: { teamId },
    onData: ({ data: subData }) => {
      const newNotification = subData.data.notificationAdded;
      console.log('New notification:', newNotification);
      setNotifications(prev => [newNotification, ...prev.slice(0, 4)]);
      refetch();
    }
  });
  
  const tasks = data?.tasks || [];
  const todoTasks = tasks.filter((t: Task) => t.status === 'todo');
  const inprogressTasks = tasks.filter((t: Task) => t.status === 'inprogress');
  const doneTasks = tasks.filter((t: Task) => t.status === 'done');

  if (loading) return <p>Loading tasks...</p>;
  if (error) return <p>Error loading tasks: {error.message}</p>;

  return (
    <>
      <NewTaskForm teamId={teamId} />
      <NotificationFeed notifications={notifications} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Kirim user ke TaskColumn */}
        <TaskColumn title="To Do" tasks={todoTasks} user={user} />
        <TaskColumn title="In Progress" tasks={inprogressTasks} user={user} />
        <TaskColumn title="Done" tasks={doneTasks} user={user} />
      </div>
    </>
  );
}

// 6. KOLOM TUGAS (DIPERBARUI)
function TaskColumn({ title, tasks, user }: { title: string; tasks: Task[]; user: User }) {
  const [updateTaskStatus] = useMutation(UPDATE_TASK_STATUS);
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const newStatus = title.toLowerCase().replace(' ', '') as Task['status'];
    try {
      await updateTaskStatus({ variables: { id: taskId, status: newStatus }});
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  return (
    <div 
      className="bg-gray-200 p-4 rounded-lg min-h-[300px]"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <h3 className="font-bold text-xl mb-4 text-gray-800">{title}</h3>
      <div className="space-y-3">
        {tasks.map((task) => (
          // Kirim user ke TaskCard
          <TaskCard key={task.id} task={task} user={user} />
        ))}
        {tasks.length === 0 && <p className="text-gray-500 text-sm italic text-center">Empty</p>}
      </div>
    </div>
  );
}

// 7. KARTU TUGAS (DIPERBARUI)
function TaskCard({ task, user }: { task: Task; user: User }) {
  const [deleteTask, { loading }] = useMutation(DELETE_TASK);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task.id);
  };
  
  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) return;
    try {
      await deleteTask({ variables: { id: task.id } });
    } catch (err: any) {
      console.error('Failed to delete task:', err);
      alert(`Error: ${err.message}`); // Tampilkan error jika bukan admin
    }
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="bg-white p-4 rounded-md shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-start">
        <h4 className="font-semibold">{task.title}</h4>
        {/* LOGIKA PERAN BARU: Tampilkan tombol Hapus HANYA jika admin */}
        {user.role === 'admin' && (
          <button 
            onClick={handleDelete}
            disabled={loading}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {loading ? '...' : 'X'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
      <span className="text-xs text-gray-500 mt-2 block">ID: {task.id.split('-')[0]}...</span>
    </div>
  );
}

// 8. FORM TUGAS BARU (Sama seperti sebelumnya, tidak perlu diubah)
function NewTaskForm({ teamId }: { teamId: string }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createTask, { loading }] = useMutation(CREATE_TASK);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    try {
      await createTask({ variables: { title, description, teamId } });
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md flex gap-4">
      <input type="text" placeholder="New task title" value={title} onChange={(e) => setTitle(e.target.value)} className="border rounded-md px-3 py-2 flex-grow" required />
      <input type="text" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded-md px-3 py-2 flex-grow" />
      <button type="submit" disabled={loading} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400">{loading ? 'Adding...' : 'Add Task'}</button>
    </form>
  );
}

// 9. UMPAN NOTIFIKASI (Sama seperti sebelumnya, tidak perlu diubah)
function NotificationFeed({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) return null;
  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="font-semibold text-blue-800">Real-time Notifications:</h4>
      <ul className="list-disc list-inside mt-2">
        {notifications.map((notif) => (
          <li key={notif.id} className="text-sm text-blue-700">{notif.message}</li>
        ))}
      </ul>
    </div>
  );
}

// 10. Komponen "Join Team" (Sama seperti sebelumnya, tidak perlu diubah)
function JoinTeamPage({ user, onTeamJoined }: { user: User, onTeamJoined: (user: User) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const joinDefaultTeam = async () => {
      console.log("User has no team. Attempting to join 'team-1' via API...");
      try {
        const response = await authApi.joinTeam({ teamId: 'team-1' });
        const { token, user: updatedUser } = response.data;
        localStorage.setItem('jwt_token', token);
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
        onTeamJoined(updatedUser);
      } catch (err: any) {
        console.error("Failed to join team:", err);
        setError(err.response?.data?.error || "Could not join team");
      } finally {
        setLoading(false);
      }
    };
    if (localStorage.getItem('jwt_token')) {
      joinDefaultTeam();
    } else {
      setError("Token not found. Please log in again.");
    }
  }, [user, onTeamJoined]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-2xl font-bold text-red-500">Error: {error}</p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-2xl font-bold">Joining default team 'team-1'...</p>
    </div>
  );
}