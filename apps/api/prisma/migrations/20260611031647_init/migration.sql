-- CreateTable
CREATE TABLE "players" (
    "id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "coins" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "per_tap" INTEGER NOT NULL DEFAULT 1,
    "max_energy" INTEGER NOT NULL DEFAULT 500,
    "regen" INTEGER NOT NULL DEFAULT 2,
    "energy" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "energy_ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mult_n" INTEGER NOT NULL DEFAULT 0,
    "batt_n" INTEGER NOT NULL DEFAULT 0,
    "chg_n" INTEGER NOT NULL DEFAULT 0,
    "auto_n" INTEGER NOT NULL DEFAULT 0,
    "equipped_skin" TEXT NOT NULL DEFAULT 'classic',
    "owned_skins" JSONB NOT NULL DEFAULT '["classic"]',
    "referred_by" BIGINT,
    "ref_count" INTEGER NOT NULL DEFAULT 0,
    "last_sync_nonce" TEXT,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" BIGSERIAL NOT NULL,
    "referrer_id" BIGINT NOT NULL,
    "referee_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewarded_at" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_players_total" ON "players"("total" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referee_id_key" ON "referrals"("referee_id");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
