package com.vireocode.startertemplate.app.offline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Daily maintenance for the framework-owned replay ledger, without logging payloads or owners. */
@Component
class AppOfflineMaintenance {

    private static final Logger log = LoggerFactory.getLogger(AppOfflineMaintenance.class);

    private final JdbcTemplate jdbc;

    AppOfflineMaintenance(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "UTC")
    @Transactional
    void purgeExpiredReplayCommands() {
        int purged = jdbc.update("""
                DELETE FROM sync_command
                WHERE legal_hold = FALSE
                  AND retain_until < CURRENT_TIMESTAMP
                """);
        if (purged > 0) {
            log.info("Purged {} expired offline replay commands.", purged);
        }
    }
}
