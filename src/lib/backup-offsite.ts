import { execFile } from "child_process";

export interface OffsiteResult {
  attempted: boolean;
  success: boolean;
  message: string;
}

/**
 * Uploads a local backup file to an off-site destination using rclone, if configured.
 *
 * Configuration (environment):
 *   BACKUP_REMOTE     rclone destination, e.g. "gdrive:fuel-backups" or "s3:bucket/path".
 *                     When unset, this is a no-op (attempted: false).
 *   BACKUP_RCLONE_BIN optional path to the rclone binary (default: "rclone").
 *
 * Never throws — returns a result the caller can log. A failed off-site upload must
 * never break the local backup.
 */
export async function uploadBackupOffsite(backupPath: string): Promise<OffsiteResult> {
  const remote = process.env.BACKUP_REMOTE?.trim();
  if (!remote) {
    return { attempted: false, success: false, message: "BACKUP_REMOTE not set; off-site upload skipped." };
  }

  const bin = process.env.BACKUP_RCLONE_BIN?.trim() || "rclone";

  return new Promise<OffsiteResult>((resolve) => {
    execFile(
      bin,
      ["copy", backupPath, remote, "--no-traverse"],
      { timeout: 5 * 60 * 1000 },
      (err, _stdout, stderr) => {
        if (err) {
          const detail = (stderr || err.message || "").toString().trim();
          resolve({
            attempted: true,
            success: false,
            message: `rclone upload to "${remote}" failed: ${detail}`,
          });
        } else {
          resolve({
            attempted: true,
            success: true,
            message: `uploaded to "${remote}"`,
          });
        }
      }
    );
  });
}
