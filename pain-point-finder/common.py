"""Shared logging + retry helpers used across ingest, classify, cluster, digest."""
import functools
import logging
import sys
import time


def setup_logging(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    )
    logger.addHandler(handler)
    logger.propagate = False
    return logger


def retry(attempts: int = 3, base_delay: float = 1.0, exceptions: tuple = (Exception,)):
    """Retry a function with exponential backoff (base_delay, 2x, 4x, ...)."""

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            logger = logging.getLogger(fn.__module__)
            last_exc = None
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as exc:
                    last_exc = exc
                    if attempt == attempts:
                        break
                    delay = base_delay * (2 ** (attempt - 1))
                    logger.warning(
                        "%s failed (attempt %d/%d): %s — retrying in %.1fs",
                        fn.__name__, attempt, attempts, exc, delay,
                    )
                    time.sleep(delay)
            raise last_exc

        return wrapper

    return decorator


class NotConfiguredError(Exception):
    """Raised when a source's required credentials are missing."""
