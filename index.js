const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');

// Server configuration
const config = {
    ip: "chupadoresdepika.aternos.me",
    port: 14595,
    name: "Nig",
    loginmsg: "ana bot"
};

let bot;

function createBot() {
    console.log(`[${new Date().toISOString()}] Connecting to ${config.ip}:${config.port}...`);

    bot = mineflayer.createBot({
        host: config.ip,
        port: config.port,
        username: config.name,
        version: false, // Auto-detect
        auth: 'offline'
    });

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log(`[${new Date().toISOString()}] Bot spawned! Starting anti-AFK...`);

        // Send login message
        setTimeout(() => {
            bot.chat(config.loginmsg);
        }, 3000);

        // Start anti-AFK movements
        startAntiAFK();
    });

    // Prevent sleeping (so you can skip night when playing)
    bot.on('sleep', () => {
        bot.wake();
    });

    // Auto-respawn
    bot.on('death', () => {
        console.log(`[${new Date().toISOString()}] Died! Respawning...`);
    });

    // Respond to chat
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;

        if (message.toLowerCase().includes('bot status')) {
            bot.chat('✓ Online and active!');
        }
    });

    // Handle disconnections
    bot.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Error:`, err.message);
    });

    bot.on('end', (reason) => {
        console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
        // Reconnect after 30 seconds
        setTimeout(createBot, 30000);
    });

    bot.on('kicked', (reason) => {
        console.log(`[${new Date().toISOString()}] Kicked: ${reason}`);
        // Reconnect after 60 seconds if kicked
        setTimeout(createBot, 60000);
    });
}

function startAntiAFK() {
    // Random movement every 1-2 minutes
    setInterval(() => {
        if (!bot || !bot.entity) return;

        const actions = [
            () => bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI),
            () => {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 100);
            },
            () => {
                bot.setControlState('forward', true);
                setTimeout(() => bot.setControlState('forward', false), 500);
            },
            () => bot.swingArm()
        ];

        // Do random action
        actions[Math.floor(Math.random() * actions.length)]();

    }, 60000 + Math.random() * 60000); // 1-2 minutes

    // Log status every 10 minutes
    setInterval(() => {
        if (bot && bot.entity) {
            console.log(`[${new Date().toISOString()}] Status: Online | Health: ${bot.health}/20 | Food: ${bot.food}/20`);
        }
    }, 600000);
}

// Start the bot
createBot();

// Keep process alive
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    // Try to reconnect after fatal error
    setTimeout(createBot, 30000);
});