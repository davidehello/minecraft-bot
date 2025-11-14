const mineflayer = require('mineflayer');
const express = require('express');
const https = require('https');

// IMPORTANT: Web server for Render (they require an open port)
const app = express();
const PORT = process.env.PORT || 10000; // Render uses PORT env variable

// Get the Render service URL
const SERVICE_URL = process.env.RENDER_EXTERNAL_URL;

app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime() / 60);
    res.send(`
        <html>
        <head>
            <title>Minecraft Bot Status</title>
            <meta http-equiv="refresh" content="60">
        </head>
        <body style="font-family: Arial; background: #1a1a2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <div style="text-align: center; padding: 40px; background: rgba(0,0,0,0.5); border-radius: 10px;">
                <h1>🎮 Minecraft Bot Status</h1>
                <p style="font-size: 24px; color: ${botConnected ? '#4CAF50' : '#ff9800'};">
                    ${botConnected ? '✅ Bot Connected' : '⏳ Bot Connecting...'}
                </p>
                <p>Server: ${config.ip}:${config.port}</p>
                <p>Bot: ${config.name}</p>
                <p>Uptime: ${uptime} minutes</p>
                <p>Status: ${lastStatus}</p>
                <p style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
                    Auto-refresh every 60 seconds to keep service alive
                </p>
            </div>
        </body>
        </html>
    `);
});

// Health endpoint for monitoring
app.get('/health', (req, res) => {
    res.json({
        status: botConnected ? 'online' : 'connecting',
        uptime: process.uptime(),
        lastPing: new Date().toISOString()
    });
});

// Keep-alive endpoint
app.get('/ping', (req, res) => {
    res.json({
        message: 'pong',
        timestamp: Date.now(),
        botStatus: botConnected ? 'connected' : 'connecting'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server running on port ${PORT}`);

    // Start self-pinging after server starts
    if (SERVICE_URL) {
        console.log(`Service URL detected: ${SERVICE_URL}`);
        startSelfPing();
    } else {
        console.log('No SERVICE_URL detected - you may need to set up external pinging');
    }
});

// Self-ping function to keep Render service alive
function startSelfPing() {
    // Ping every 10 minutes to prevent shutdown
    setInterval(() => {
        if (SERVICE_URL) {
            const url = SERVICE_URL.startsWith('http') ? SERVICE_URL : `https://${SERVICE_URL}`;
            https.get(`${url}/ping`, (res) => {
                console.log(`[${new Date().toISOString()}] Self-ping successful: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error(`Self-ping failed: ${err.message}`);
            });
        }
    }, 10 * 60 * 1000); // Every 10 minutes
}

// Your server configuration
const config = {
    ip: "chupadoresdepika.aternos.me",
    port: 14595,
    name: "Nigger[BOT]",
    loginmsg: "Bot ativo, aternos 24/7 ativado!"
};

let bot = null;
let botConnected = false;
let lastStatus = "Starting...";
let isReconnecting = false;
let reconnectTimer = null;

function createBot() {
    // Prevent multiple simultaneous connection attempts
    if (isReconnecting) {
        console.log(`[${new Date().toISOString()}] Already reconnecting, skipping...`);
        return;
    }

    console.log(`[${new Date().toISOString()}] Creating bot...`);
    lastStatus = "Connecting to server...";

    bot = mineflayer.createBot({
        host: config.ip,
        port: config.port,
        username: config.name,
        version: false, // Auto-detect version
        auth: 'offline',
        checkTimeoutInterval: 60000,
        keepAlive: true,
        skipValidation: true
    });

    // Successfully spawned
    bot.once('spawn', () => {
        console.log(`[${new Date().toISOString()}] ✅ Bot spawned successfully!`);
        botConnected = true;
        isReconnecting = false;
        lastStatus = "Online and active";

        // Clear any pending reconnect timers
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // Send login message after 3 seconds
        setTimeout(() => {
            if (bot && botConnected) {
                try {
                    bot.chat(config.loginmsg);
                } catch (err) {
                    console.log("Could not send login message:", err.message);
                }
            }
        }, 3000);

        // Start anti-AFK
        startAntiAFK();
    });

    // Prevent sleeping (so you can skip night)
    bot.on('sleep', () => {
        bot.wake();
    });

    // Auto-respawn on death
    bot.on('death', () => {
        console.log(`[${new Date().toISOString()}] Bot died! Will respawn...`);
        lastStatus = "Died - respawning";
    });

    // Chat commands
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;

        if (message.toLowerCase().includes('bot status')) {
            try {
                bot.chat('✓ Online and keeping server active!');
            } catch (err) {
                console.log("Could not respond to chat:", err.message);
            }
        }
    });

    // Handle kicked - IMPORTANT: Check for throttling
    bot.on('kicked', (reason) => {
        console.log(`[${new Date().toISOString()}] Kicked: ${JSON.stringify(reason)}`);
        botConnected = false;

        // Check if kicked for throttling
        if (reason && reason.toString().toLowerCase().includes('throttl')) {
            console.log("Detected throttling - waiting 60 seconds before reconnecting...");
            lastStatus = "Kicked (throttled) - waiting 60s";
            scheduleReconnect(60000); // Wait 60 seconds for throttling
        } else {
            lastStatus = "Kicked - reconnecting in 30s";
            scheduleReconnect(30000); // Normal reconnect delay
        }
    });

    // Handle errors
    bot.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Error: ${err.message}`);
        botConnected = false;
        lastStatus = `Error: ${err.message}`;

        // Don't immediately reconnect on error
        scheduleReconnect(30000);
    });

    // Handle disconnection
    bot.on('end', (reason) => {
        console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
        botConnected = false;
        lastStatus = "Disconnected - will reconnect";

        // Longer delay if we see specific disconnection reasons
        if (reason === 'socketClosed') {
            scheduleReconnect(45000); // 45 seconds for socket issues
        } else {
            scheduleReconnect(30000); // 30 seconds for other disconnects
        }
    });
}

// Centralized reconnection scheduling to prevent multiple reconnects
function scheduleReconnect(delay) {
    // Clear any existing reconnect timer
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }

    // Prevent immediate reconnection attempts
    if (isReconnecting) {
        console.log("Already scheduled to reconnect, skipping...");
        return;
    }

    isReconnecting = true;
    console.log(`[${new Date().toISOString()}] Will reconnect in ${delay/1000} seconds...`);

    reconnectTimer = setTimeout(() => {
        isReconnecting = false;
        reconnectTimer = null;

        // Clean up old bot instance
        if (bot) {
            try {
                bot.removeAllListeners();
                bot.quit();
            } catch (err) {
                // Ignore cleanup errors
            }
            bot = null;
        }

        createBot();
    }, delay);
}

// Anti-AFK system
function startAntiAFK() {
    const antiAfkInterval = setInterval(() => {
        if (!bot || !botConnected) {
            clearInterval(antiAfkInterval);
            return;
        }

        try {
            const actions = [
                () => bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI),
                () => {
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 100);
                },
                () => {
                    bot.setControlState('forward', true);
                    setTimeout(() => {
                        bot.setControlState('forward', false);
                    }, 300);
                },
                () => bot.swingArm(),
                () => {
                    bot.setControlState('sneak', true);
                    setTimeout(() => bot.setControlState('sneak', false), 1000);
                }
            ];

            // Execute random action
            const action = actions[Math.floor(Math.random() * actions.length)];
            action();
        } catch (err) {
            console.log("Anti-AFK action failed:", err.message);
        }
    }, 60000 + Math.random() * 60000); // Every 1-2 minutes

    // Status logging every 10 minutes
    const statusInterval = setInterval(() => {
        if (!bot || !botConnected) {
            clearInterval(statusInterval);
            return;
        }

        try {
            console.log(`[${new Date().toISOString()}] Status: Online | Health: ${bot.health}/20 | Food: ${bot.food}/20`);
            lastStatus = `Online - Health: ${bot.health}/20`;
        } catch (err) {
            console.log("Could not log status:", err.message);
        }
    }, 600000);
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log("Shutting down gracefully...");
    if (bot) {
        bot.quit();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log("Received SIGTERM, shutting down...");
    if (bot) {
        bot.quit();
    }
    process.exit(0);
});

// Catch uncaught exceptions to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    lastStatus = "Recovering from error";

    // Don't immediately try to reconnect
    if (!isReconnecting) {
        scheduleReconnect(60000); // Wait 60 seconds after crash
    }
});

// Start the bot with initial delay to let server start
console.log("Starting Minecraft bot in 5 seconds...");
setTimeout(() => {
    createBot();
}, 5000);