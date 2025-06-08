import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: true,
            allowedHeaders: ["my-custom-header"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);

        // Join poll room for live updates
        socket.on('joinPoll', (pollId) => {
            socket.join(`poll_${pollId}`);
            console.log(`Socket ${socket.id} joined poll ${pollId}`);
        });

        // Leave poll room
        socket.on('leavePoll', (pollId) => {
            socket.leave(`poll_${pollId}`);
            console.log(`Socket ${socket.id} left poll ${pollId}`);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};