import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				hover: '#1D4ED8',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			success: '#16A34A',
  			warning: '#D97706',
  			danger: '#DC2626',
  			surface: '#F8FAFC',
  			border: 'hsl(var(--border))',
  			text: {
  				primary: '#0F172A',
  				secondary: '#64748B',
  				muted: '#94A3B8'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-inter)',
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-jetbrains)',
  				'JetBrains Mono',
  				'monospace'
  			]
  		},
  		boxShadow: {
  			soft: '0 10px 30px rgba(15, 23, 42, 0.08)'
  		},
  		backgroundImage: {
  			'hero-glow': 'radial-gradient(circle at top, rgba(37, 99, 235, 0.18), transparent 55%)'
  		},
  		keyframes: {
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-6px)'
  				}
  			},
  			'fade-up': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(12px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0px)'
  				}
  			}
  		},
  		animation: {
  			float: 'float 6s ease-in-out infinite',
  			'fade-up': 'fade-up 0.6s ease-out forwards'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
