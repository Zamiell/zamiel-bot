import winston from "winston";

const log = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: "ddd MMM DD HH:mm:ss YYYY",
        }),
        winston.format.printf(
          (info) =>
            `${info["timestamp"]} - ${info.level.toUpperCase()} - ${
              info.message
            }`,
        ),
      ),
    }),
  ],
});
export default log;
