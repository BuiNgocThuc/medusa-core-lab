import { ICachingModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import crypto from "node:crypto";

export interface PendingLinkSessionData {
    session_id: string;
    auth_identity_id: string;
    provider: string;
    attempt_count: number;
    created_at: number;
}

type InjectedDependencies = {
    cachingModuleService?: ICachingModuleService;
    [Modules.CACHING]?: ICachingModuleService;
};

export class PendingLinkSessionService {
    public static readonly TTL_SECONDS = 900; // 15 minutes
    public static readonly MAX_ATTEMPTS = 5;
    public static readonly KEY_PREFIX = "pending_link:";

    protected cachingService_: ICachingModuleService;

    constructor(container: InjectedDependencies) {
        this.cachingService_ = (container.cachingModuleService ||
            container[Modules.CACHING]) as ICachingModuleService;
    }

    private buildKey(sessionId: string): string {
        return `${PendingLinkSessionService.KEY_PREFIX}${sessionId}`;
    }

    /**
     * Initializes a pending identity linking session with Zero-PII payload in Redis.
     */
    async createSession(data: {
        auth_identity_id: string;
        provider: string;
    }): Promise<PendingLinkSessionData> {
        const sessionId = crypto.randomUUID();
        const sessionData: PendingLinkSessionData = {
            session_id: sessionId,
            auth_identity_id: data.auth_identity_id,
            provider: data.provider,
            attempt_count: 0,
            created_at: Date.now(),
        };

        await this.cachingService_.set({
            key: this.buildKey(sessionId),
            data: sessionData,
            ttl: PendingLinkSessionService.TTL_SECONDS,
            options: {
                autoInvalidate: false,
            },
        });

        return sessionData;
    }

    /**
     * Retrieves pending link session from Redis. Returns null if expired or missing.
     */
    async getSession(sessionId: string): Promise<PendingLinkSessionData | null> {
        if (!sessionId) {
            return null;
        }

        const session = (await this.cachingService_.get({
            key: this.buildKey(sessionId),
        })) as PendingLinkSessionData | null;

        return session || null;
    }

    /**
     * Increments password attempt counter. Deletes session and locks if exceeding MAX_ATTEMPTS.
     */
    async incrementAttempt(
        sessionId: string,
    ): Promise<{ session: PendingLinkSessionData | null; is_locked: boolean }> {
        const session = await this.getSession(sessionId);
        if (!session) {
            return { session: null, is_locked: true };
        }

        session.attempt_count += 1;

        if (session.attempt_count >= PendingLinkSessionService.MAX_ATTEMPTS) {
            await this.deleteSession(sessionId);
            return { session: null, is_locked: true };
        }

        await this.cachingService_.set({
            key: this.buildKey(sessionId),
            data: session,
            ttl: PendingLinkSessionService.TTL_SECONDS,
            options: {
                autoInvalidate: false,
            },
        });

        return { session, is_locked: false };
    }

    /**
     * Deletes pending link session from Redis after successful verification or expiration.
     */
    async deleteSession(sessionId: string): Promise<void> {
        if (!sessionId) {
            return;
        }

        await this.cachingService_.clear({
            key: this.buildKey(sessionId),
        });
    }
}
