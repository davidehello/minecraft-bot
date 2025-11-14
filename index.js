const mineflayer = require('mineflayer');
const express = require('express');

// Web server for Render
const app = express();
const PORT = process.env.PORT || 10000;

// Your server config
const config = {
    ip: "chupadoresdepika.aternos.me",
    port: 14595,
    name: "BOT",
    loginmsg: "Bot ativo, aternos 24/7 ativado!"
};

let bot = null;
let botConnected = false;
let afkInterval = null;
let extraMovementInterval = null;
let statusInterval = null;
let lastActivity = Date.now();
let reconnectAttempts = 0;
let lastError = null;

// Simple web server
app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime() / 60);
    const timeSinceActivity = Math.floor((Date.now() - lastActivity) / 1000);
    res.send(`
        <h1>Bot Status: ${botConnected ? 'ONLINE' : 'OFFLINE'}</h1>
        <p>Uptime: ${uptime} minutes</p>
        <p>Last activity: ${timeSinceActivity} seconds ago</p>
        <p>Reconnect attempts: ${reconnectAttempts}</p>
        ${lastError ? `<p>Last error: ${lastError}</p>` : ''}
    `);
});

app.get('/ping', (req, res) => {
    res.json({ alive: true });
});

app.listen(PORT, () => {
    console.log(`Web server on port ${PORT}`);
});

function cleanupBot() {
    stopAntiAFK();

    if (bot) {
        try {
            bot.removeAllListeners();
            if (bot._client) {
                bot._client.removeAllListeners();
                bot._client.end();
            }
            bot.quit();
        } catch (e) {
            // Ignore cleanup errors
        }
        bot = null;
    }

    botConnected = false;
}

function createBot() {
    console.log(`[${new Date().toISOString()}] Creating bot (attempt ${++reconnectAttempts})...`);

    // Clean up any existing bot first
    cleanupBot();

    // Set connection timeout BEFORE creating bot
    const connectionTimeout = setTimeout(() => {
        console.log(`[${new Date().toISOString()}] Connection timeout - server might be offline`);
        lastError = "Connection timeout - server offline?";
        cleanupBot();
        console.log(`[${new Date().toISOString()}] Will retry in 30 seconds...`);
        setTimeout(createBot, 30000);
    }, 30000); // 30 second timeout for connection

    try {
        bot = mineflayer.createBot({
            host: config.ip,
            port: config.port,
            username: config.name,
            version: false,
            auth: 'offline',
            keepAlive: true,
            keepAliveInterval: 10000, // Send keep-alive every 10 seconds
            checkTimeoutInterval: 300000, // 5 minute timeout
            colorsEnabled: false,
            viewDistance: 'tiny',
            skipValidation: true
        });

        bot.once('spawn', () => {
            clearTimeout(connectionTimeout);
            console.log(`[${new Date().toISOString()}] ✅ Bot spawned!`);
            botConnected = true;
            lastActivity = Date.now();
            reconnectAttempts = 0;
            lastError = null;

            // Send login message
            setTimeout(() => {
                if (bot && botConnected) {
                    bot.chat(config.loginmsg);
                }
            }, 3000);

            // START AGGRESSIVE ANTI-AFK
            startAntiAFK();
        });

        bot.on('death', () => {
            console.log(`[${new Date().toISOString()}] Died - respawning in 5s`);
            setTimeout(() => {
                if (bot) bot.respawn();
            }, 5000);
        });

        bot.on('kicked', (reason) => {
            const reasonStr = JSON.stringify(reason).substring(0, 100);
            console.log(`[${new Date().toISOString()}] KICKED: ${reasonStr}`);
            lastError = `Kicked: ${reasonStr}`;
            botConnected = false;
            cleanupBot();

            // Check if it's a throttle kick
            if (reasonStr.toLowerCase().includes('throttl')) {
                console.log('Connection throttled - waiting 60 seconds');
                setTimeout(createBot, 60000);
            } else {
                setTimeout(createBot, 30000);
            }
        });

        bot.on('end', (reason) => {
            console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
            lastError = `Disconnected: ${reason}`;
            botConnected = false;
            cleanupBot();
            setTimeout(createBot, 30000);
        });

        bot.on('error', (err) => {
            clearTimeout(connectionTimeout);
            console.log(`[${new Date().toISOString()}] Error: ${err.message}`);
            lastError = err.message;

            // For connection errors, force reconnect
            if (err.message.includes('ECONNREFUSED') ||
                err.message.includes('ETIMEDOUT') ||
                err.message.includes('ECONNRESET') ||
                err.message.includes('ENOTFOUND') ||
                err.message.includes('getaddrinfo')) {
                console.log(`[${new Date().toISOString()}] Connection failed - server might be offline. Retrying in 30 seconds...`);
                botConnected = false;
                cleanupBot();
                setTimeout(createBot, 30000);
            }
        });

        // Prevent sleeping
        bot.on('sleep', () => {
            bot.wake();
        });

    } catch (err) {
        clearTimeout(connectionTimeout);
        console.log(`[${new Date().toISOString()}] Failed to create bot: ${err.message}`);
        lastError = err.message;
        console.log(`[${new Date().toISOString()}] Will retry in 30 seconds...`);
        setTimeout(createBot, 30000);
    }
}

function startAntiAFK() {
    console.log(`[${new Date().toISOString()}] Starting Anti-AFK`);

    // Clear any existing intervals
    stopAntiAFK();

    // Move every 15 seconds to prevent AFK
    afkInterval = setInterval(() => {
        if (!bot || !botConnected) {
            stopAntiAFK();
            return;
        }

        try {
            // Random look
            bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI / 2);

            // Swing arm
            bot.swingArm();

            // Jump
            bot.setControlState('jump', true);
            setTimeout(() => {
                if (bot) bot.setControlState('jump', false);
            }, 100);

            // Small random movement
            const move = ['forward', 'back', 'left', 'right'][Math.floor(Math.random() * 4)];
            bot.setControlState(move, true);
            setTimeout(() => {
                if (bot) bot.setControlState(move, false);
            }, 200);

            // Sneak toggle
            bot.setControlState('sneak', true);
            setTimeout(() => {
                if (bot) bot.setControlState('sneak', false);
            }, 200);

            lastActivity = Date.now();
            console.log(`[${new Date().toISOString()}] Anti-AFK tick`);

        } catch (err) {
            console.log(`[${new Date().toISOString()}] Anti-AFK error: ${err.message}`);
        }
    }, 15000); // Every 15 seconds

    // Additional movement every 45 seconds for variety
    extraMovementInterval = setInterval(() => {
        if (!bot || !botConnected) return;

        try {
            // Strafe left/right
            const strafe = Math.random() > 0.5 ? 'left' : 'right';
            bot.setControlState(strafe, true);
            setTimeout(() => {
                if (bot) bot.setControlState(strafe, false);
            }, 300);

            // Sprint briefly
            bot.setControlState('sprint', true);
            bot.setControlState('forward', true);
            setTimeout(() => {
                if (bot) {
                    bot.setControlState('sprint', false);
                    bot.setControlState('forward', false);
                }
            }, 1000);

            console.log(`[${new Date().toISOString()}] Extra movement`);
        } catch (err) {
            // Ignore
        }
    }, 45000);

    // Log status every 2 minutes
    statusInterval = setInterval(() => {
        if (bot && botConnected && bot.entity) {
            console.log(`[${new Date().toISOString()}] STATUS: Health=${bot.health}/20, Food=${bot.food}/20`);
        }
    }, 120000);
}

function stopAntiAFK() {
    if (afkInterval) {
        clearInterval(afkInterval);
        afkInterval = null;
    }
    if (extraMovementInterval) {
        clearInterval(extraMovementInterval);
        extraMovementInterval = null;
    }
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
}

// Reconnect loop
setInterval(() => {
    if (!botConnected) {
        console.log(`[${new Date().toISOString()}] Bot offline - reconnecting...`);
        createBot();
    } else if (bot && bot.entity) {
        // Check if bot is actually responsive
        try {
            const pos = bot.entity.position;
            // Try to move slightly to test responsiveness
            bot.look(bot.entity.yaw + 0.1, bot.entity.pitch);
        } catch (err) {
            console.log(`[${new Date().toISOString()}] Bot unresponsive - reconnecting`);
            botConnected = false;
            if (bot) bot.end();
        }
    }
}, 60000);

// Watchdog timer - restart if no activity for 5 minutes
setInterval(() => {
    const timeSinceActivity = Date.now() - lastActivity;

    // If no activity for 5 minutes and bot thinks it's connected
    if (timeSinceActivity > 300000 && botConnected) {
        console.log(`[${new Date().toISOString()}] WATCHDOG: Bot frozen - forcing restart`);
        botConnected = false;
        cleanupBot();
        setTimeout(createBot, 5000);
    }

    // Don't create multiple bots - the retry logic will handle it
}, 60000); // Check every minute

// Process-level error handling
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] UNCAUGHT: ${err.message}`);
    lastError = `Uncaught: ${err.message}`;

    // For packet errors or critical errors, restart bot
    if (err.message.includes('Chunk size') ||
        err.message.includes('Cannot read') ||
        err.message.includes('Packet') ||
        err.message.includes('Invalid') ||
        err.message.includes('partial packet')) {
        console.log('Critical error - restarting bot');
        botConnected = false;
        cleanupBot();
        setTimeout(createBot, 10000);
    }
});

process.on('unhandledRejection', (reason) => {
    console.error(`[${new Date().toISOString()}] UNHANDLED: ${reason}`);
    lastError = `Unhandled: ${reason}`;
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    cleanupBot();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    cleanupBot();
    process.exit(0);
});

// Memory management - log memory usage
setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[${new Date().toISOString()}] Memory: RSS=${Math.round(mem.rss/1024/1024)}MB, Heap=${Math.round(mem.heapUsed/1024/1024)}MB`);

    // If memory usage is too high, restart
    if (mem.heapUsed > 400 * 1024 * 1024) { // 400MB
        console.log('Memory usage too high - restarting bot');
        cleanupBot();
        setTimeout(createBot, 5000);
    }
}, 300000); // Every 5 minutes

// Start
console.log('=================================');
console.log('MINECRAFT BOT - SIMPLE & RELIABLE');
console.log('=================================');
console.log(`Connecting to ${config.ip}:${config.port}`);

// Initial connection
setTimeout(createBot, 3000);