import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { adminAPI } from '../api/client'

/**
 * Hook to periodically send heartbeat to update user's online status.
 * Call this once in your main App component.
 *
 * @param {number} intervalMs - Interval between heartbeats in milliseconds (default: 60000 = 1 minute)
 */
export function useHeartbeat(intervalMs = 60000) {
  const { isAuthenticated } = useAuthStore()
  const intervalRef = useRef(null)

  useEffect(() => {
    // Only start heartbeat if user is authenticated
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Send initial heartbeat
    const sendHeartbeat = async () => {
      try {
        await adminAPI.heartbeat()
      } catch (error) {
        // Silently fail - don't disrupt user experience
        console.debug('Heartbeat failed:', error.message)
      }
    }

    // Send immediately on login
    sendHeartbeat()

    // Set up interval
    intervalRef.current = setInterval(sendHeartbeat, intervalMs)

    // Cleanup on unmount or when auth changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isAuthenticated, intervalMs])
}

export default useHeartbeat
const sendHeartbeat = async () => {
  try {
    console.log('Sending heartbeat')
    await adminAPI.heartbeat()
  } catch (error) {
    console.debug('Heartbeat failed:', error.message)
  }
}

