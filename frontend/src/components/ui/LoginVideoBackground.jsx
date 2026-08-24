import { useState } from 'react'

/**
 * LoginVideoBackground
 * Camada de vídeo full-viewport para a tela de login.
 * Posicionamento: absolute/inset-0, z-0 — sempre atrás do conteúdo.
 * Fade-in suave ao carregar (opacity transition CSS).
 * Overlay escuro semitransparente para contraste do formulário.
 * pointer-events: none em tudo — não interfere com cliques no formulário.
 */
export default function LoginVideoBackground() {
  const [videoLoaded, setVideoLoaded] = useState(false)

  return (
    <div
      className="absolute inset-0 z-0"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      {/* Poster / fallback enquanto o vídeo não carrega */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/video-poster.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Vídeo principal */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: videoLoaded ? 1 : 0,
          transition: 'opacity 1.4s ease',
        }}
        autoPlay
        loop
        muted
        playsInline
        poster="/video-poster.svg"
        onCanPlay={() => setVideoLoaded(true)}
      >
        <source src="/video-bg.mp4" type="video/mp4" />
      </video>

      {/* Overlay escuro — garante contraste do formulário sobre qualquer cena */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(7,10,15,0.72) 0%, rgba(7,10,15,0.55) 50%, rgba(7,10,15,0.68) 100%)',
        }}
      />

      {/* Vinheta sutil nas bordas para profundidade */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 120px rgba(7,10,15,0.6)',
        }}
      />
    </div>
  )
}
