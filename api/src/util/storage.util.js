const fs = require('fs');
const { DateTime } = require('luxon');
const schedule = require('node-schedule');
const logger = require('./logger.util');
const time = require('./time.util');
const { SAVE_UNKNOWN, STORAGE_PATH, PURGE_UNKNOWN, PURGE_MATCHES } = require('../constants');

module.exports.purge = async () => {
  schedule.scheduleJob('* * * * *', async () => {
    try {
      let purged = 0;
      const files = await fs.promises.readdir(`${STORAGE_PATH}/matches`, { withFileTypes: true });
      const folders = files.filter((file) => file.isDirectory()).map((file) => file.name);

      for (const folder of folders) {
        const folderFiles = await fs.promises.readdir(`${STORAGE_PATH}/matches/${folder}`, {
          withFileTypes: true,
        });
        const folderImages = folderFiles
          .filter((file) => file.isFile())
          .map((file) => file.name)
          .filter(
            (file) =>
              file.toLowerCase().includes('.jpeg') ||
              file.toLowerCase().includes('.jpg') ||
              file.toLowerCase().includes('.png')
          );
        purged += await this.delete(`matches/${folder}`, folderImages);
      }

      if (purged > 0) logger.log(`${time.current()}\npurged ${purged} matched file(s)`);
    } catch (error) {
      logger.log(`purge error: ${error.message}`);
    }
  });
};

module.exports.setup = () => {
  if (!fs.existsSync(`${STORAGE_PATH}/matches`)) {
    fs.mkdirSync(`${STORAGE_PATH}/matches`, { recursive: true });
  }
  if (SAVE_UNKNOWN && !fs.existsSync(`${STORAGE_PATH}/matches/unknown`)) {
    fs.mkdirSync(`${STORAGE_PATH}/matches/unknown`, { recursive: true });
  }
  if (!fs.existsSync(`${STORAGE_PATH}/train`)) {
    fs.mkdirSync(`${STORAGE_PATH}/train`, { recursive: true });
  }
};

module.exports.delete = async (path, images) => {
  const purged = [];
  for (const image of images) {
    const { birthtime } = await fs.promises.stat(`${STORAGE_PATH}/${path}/${image}`);
    const duration = DateTime.now().diff(DateTime.fromISO(birthtime.toISOString()), 'hours');
    const { hours } = duration.toObject();
    const purgeTime = path === 'matches/unknown' ? PURGE_UNKNOWN : PURGE_MATCHES;
    if (hours >= purgeTime) {
      try {
        await fs.promises.unlink(`${STORAGE_PATH}/${path}/${image}`);
        purged.push(image);
      } catch (error) {
        logger.log(`delete error: ${error.message}`);
      }
    }
  }
  return purged.length;
};
