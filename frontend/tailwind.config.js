export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Antes apontava pra um azul claro (#0D47A1) sobre fundo quase-branco.
        // Agora religado no accent cobre que já existia no token `copper` abaixo.
        primary: {
          50: '#241811',   // fundo de chip/ícone (tint escuro, não claro)
          100: '#3A2818',
          500: '#E2905B',  // cobre — accent de texto/ícone
          700: '#F2B98A',  // cobre claro — hover/links
          900: '#E2905B',  // cobre — usado em botões e marcas sólidas
        },
        success: { 50: '#0F2A20', 700: '#34D399' },
        warning: { 50: '#2A2210', 700: '#F5B94D' },
        danger:  { 50: '#2A1414', 700: '#F76767' },

        // Antes: base quase-branca (#F8FAFC). Agora religado no `graphite` que já existia.
        surface: {
          base:   '#070A0F', // = graphite.DEFAULT
          raised: '#111827', // = graphite.card
          subtle: '#0D1117', // = graphite.surface
        },
        ink: {
          primary:   '#F5F7FA', // texto principal, quase branco
          secondary: '#A8B1BE',
          muted:     '#7C8494',
        },
        status: {
          ok: '#34D399',
          alerta: '#F5B94D',
          critico: '#F76767',
        },

        // Mantidos como já estavam — foram a base pra tudo acima.
        copper: {
          DEFAULT: '#E2905B',
          dark:    '#d4804b',
          light:   '#eaaa80',
        },
        graphite: {
          DEFAULT: '#070A0F',
          surface: '#0D1117',
          card:    '#111827',
        },
      }
    }
  },
  plugins: []
}
