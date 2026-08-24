import axios from 'axios'

function getApiOrigin() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '').replace(/\/api$/i, '')
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin
    if (origin.includes(':5173')) {
      return origin.replace(':5173', ':8000')
    }
    return origin
  }
  return 'http://127.0.0.1:8000'
}

const API_ORIGIN = getApiOrigin()
const API_BASE = `${API_ORIGIN}/api`

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  }
)

export default api

