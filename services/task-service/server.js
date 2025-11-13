const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub, withFilter } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { createServer } = require('http');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');

const app = express();
const pubsub = new PubSub();
const NOTIFICATION_ADDED = 'NOTIFICATION_ADDED';

// Data
let tasks = [
  { id: '1', title: 'Set up project structure', description: 'Create folders for all 4 services', status: 'done', teamId: 'team-1', assignedToId: 'user-1', createdAt: new Date().toISOString() },
  { id: '2', title: 'Implement JWT Auth', description: 'User service creates token, Gateway verifies token', status: 'inprogress', teamId: 'team-1', assignedToId: 'user-1', createdAt: new Date().toISOString() },
  { id: '3', title: 'Build Frontend UI', description: 'Create login page and task board', status: 'todo', teamId: 'team-1', assignedToId: 'user-2', createdAt: new Date().toISOString() }
];

// GraphQL type definitions
const typeDefs = `
  enum TaskStatus { todo, inprogress, done }
  type Task { id: ID!, title: String!, description: String, status: TaskStatus!, teamId: ID!, assignedToId: ID, createdAt: String! }
  type Notification { id: ID!, message: String!, teamId: ID!, task: Task }
  type Query { tasks(teamId: ID!): [Task!]!, task(id: ID!): Task }
  type Mutation {
    createTask(title: String!, description: String, teamId: ID!, assignedToId: ID): Task!
    updateTaskStatus(id: ID!, status: TaskStatus!): Task!
    deleteTask(id: ID!): Boolean!
  }
  type Subscription { notificationAdded(teamId: ID!): Notification! }
`;

// GraphQL resolvers (DIPERBARUI)
const resolvers = {
  Query: {
    tasks: (_, { teamId }, context) => {
      // Cek teamId dari token
      if (context.user.teamId !== teamId) {
        throw new Error('Not authorized to view tasks for this team');
      }
      return tasks.filter(task => task.teamId === teamId);
    },
    task: (_, { id }, context) => {
      const task = tasks.find(task => task.id === id);
      if (!task || task.teamId !== context.user.teamId) {
        throw new Error('Task not found or not authorized');
      }
      return task;
    },
  },
  Mutation: {
    createTask: (_, { title, description, teamId, assignedToId }, context) => {
      if (context.user.teamId !== teamId) {
        throw new Error('Not authorized to create tasks for this team');
      }
      const newTask = {
        id: uuidv4(), title, description, status: 'todo', teamId, assignedToId, createdAt: new Date().toISOString()
      };
      tasks.push(newTask);
      const notification = {
        id: uuidv4(), message: `${context.user.email} created a new task: ${title}`, teamId: teamId, task: newTask
      };
      pubsub.publish(NOTIFICATION_ADDED, { notificationAdded: notification });
      return newTask;
    },
    updateTaskStatus: (_, { id, status }, context) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) throw new Error('Task not found');
      const task = tasks[taskIndex];
      if (task.teamId !== context.user.teamId) {
        throw new Error('Not authorized to update this task');
      }
      task.status = status;
      const notification = {
        id: uuidv4(), message: `${context.user.email} updated task "${task.title}" to ${status}`, teamId: task.teamId, task: task
      };
      pubsub.publish(NOTIFICATION_ADDED, { notificationAdded: notification });
      return task;
    },
    // LOGIKA PERAN (ROLE) BARU
    deleteTask: (_, { id }, context) => {
      // Cek peran dari context
      if (context.user.role !== 'admin') {
        throw new Error('Only admins can delete tasks');
      }
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) return false;
      const task = tasks[taskIndex];
      if (task.teamId !== context.user.teamId) {
        throw new Error('Not authorized');
      }
      tasks.splice(taskIndex, 1);
      const notification = {
        id: uuidv4(), message: `${context.user.email} deleted task: ${task.title}`, teamId: task.teamId, task: null
      };
      pubsub.publish(NOTIFICATION_ADDED, { notificationAdded: notification });
      return true;
    },
  },
  Subscription: {
    notificationAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([NOTIFICATION_ADDED]),
        (payload, variables) => {
          return payload.notificationAdded.teamId === variables.teamId;
        }
      ),
    },
  },
};

// Fungsi Start Server (DIPERBARUI)
async function startServer() {
  app.use(cors());
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    // BACA HEADER PERAN BARU
    context: ({ req }) => {
      const userId = req.headers['x-user-id'];
      const userEmail = req.headers['x-user-email'];
      const teamId = req.headers['x-user-teamid'];
      const userRole = req.headers['x-user-role']; // Ambil peran
      
      if (!userId) return {};
      
      return { 
        user: { 
          id: userId, 
          email: userEmail,
          teamId: teamId,
          role: userRole // Tambahkan ke context
        }
      };
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  httpServer.listen(PORT, () => {
    console.log(`🚀 Task Service (GraphQL) running on port ${PORT}`);
    console.log(`🔗 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📡 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'task-service (graphql)' });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
});