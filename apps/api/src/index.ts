/**
 * API entrypoint — delegates to the real Fastify server bootstrap (TD1).
 *
 * The docker-compose healthcheck greps for 'alive: api' in stdout; the server
 * bootstrap preserves that signal before `app.listen`.
 *
 * @rules D7, STR-2
 * @adr ADR-0001
 */
import './server.js';
