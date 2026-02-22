# ============================================
# FILE: app/workers/kb_worker.py
# Background Worker for KB Processing Jobs
# ============================================
"""
Knowledge Base Background Worker
Processes indexing jobs from the queue.

Usage:
    python -m app.workers.kb_worker
"""
import asyncio
import logging
import signal
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class KBWorker:
    """Background worker that processes KB indexing jobs."""
    
    def __init__(self, poll_interval: int = 10, batch_size: int = 5):
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.running = False
        self._shutdown_event = asyncio.Event()
    
    async def start(self):
        """Start the worker"""
        logger.info(f"Starting KB Worker (poll: {self.poll_interval}s, batch: {self.batch_size})")
        self.running = True
        
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self._handle_shutdown)
        
        await self._run_loop()
    
    def _handle_shutdown(self):
        logger.info("Shutdown signal received...")
        self.running = False
        self._shutdown_event.set()
    
    async def _run_loop(self):
        from app.db.database import AsyncSessionLocal
        from app.services.indexer_service import CrawlerService
        
        while self.running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await CrawlerService.process_pending_jobs(db, max_jobs=self.batch_size)
                    await db.commit()
                    
                    if result["processed"] > 0:
                        logger.info(f"Processed {result['processed']} jobs: {result['succeeded']} succeeded, {result['failed']} failed")
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
            
            try:
                await asyncio.wait_for(self._shutdown_event.wait(), timeout=self.poll_interval)
            except asyncio.TimeoutError:
                pass
        
        logger.info("KB Worker stopped")


async def run_worker():
    worker = KBWorker(poll_interval=10, batch_size=5)
    await worker.start()


def main():
    import os
    if not os.path.exists('app'):
        print("Error: Run from project root directory")
        sys.exit(1)
    
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        print("\nWorker stopped by user")


if __name__ == "__main__":
    main()
