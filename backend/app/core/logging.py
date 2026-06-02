import logging
import sys


LOG_FORMAT = (
    "%(asctime)s "
    "%(levelname)s "
    "%(name)s "
    "%(message)s"
)


def setup_logging() -> None:
    root_logger = logging.getLogger()

    if root_logger.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))

    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)