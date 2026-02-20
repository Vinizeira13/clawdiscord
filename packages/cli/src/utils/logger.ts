import chalk from 'chalk';

export const logger = {
  banner() {
    console.log(chalk.bold.hex('#5865F2')(`
  ╔═══════════════════════════════════════╗
  ║   🐾 ClawDiscord — Server Builder     ║
  ║   Automate your Discord in seconds    ║
  ╚═══════════════════════════════════════╝
    `));
  },

  info(msg: string) {
    console.log(chalk.white(msg));
  },

  success(msg: string) {
    console.log(chalk.green.bold(msg));
  },

  warn(msg: string) {
    console.log(chalk.yellow(msg));
  },

  error(msg: string) {
    console.log(chalk.red.bold(msg));
  },

  dim(msg: string) {
    console.log(chalk.dim(msg));
  },

  step(step: number, total: number, msg: string) {
    console.log(chalk.cyan(`  [${step}/${total}]`) + ' ' + chalk.white(msg));
  },
};
