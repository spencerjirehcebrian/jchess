import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'

function App() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Voxel Chess</h1>
      <p>Scaffold ready.</p>
    </div>
  )
}

const rootEl = document.getElementById('root')
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
