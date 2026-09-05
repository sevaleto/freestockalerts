import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

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
  			lp: {
  				bg: '#FBFAF6',
  				navy: '#071B3C',
  				teal: '#0F8075',
  				'teal-dark': '#0B6A61',
  				green: '#07875F',
  				blue: '#0868F7',
  				mint: '#E9F5F1',
  				border: '#DDE3E8',
  				muted: '#5B6B7F'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				hover: '#0B6A61',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			success: '#07875F',
  			warning: '#D97706',
  			danger: '#DC2626',
  			surface: '#FBFAF6',
  			border: 'hsl(var(--border))',
  			text: {
  				primary: '#071B3C',
  				secondary: '#5B6B7F',
  				muted: '#8A97A8'
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
  			serif: ['var(--font-serif)', 'Georgia', 'serif'],
  			script: ['var(--font-script)', 'cursive'],
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
  			'hero-glow': 'radial-gradient(60% 50% at 20% 10%, rgba(233,245,241,0.9) 0%, rgba(251,250,246,0) 70%)'
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
  plugins: [tailwindcssAnimate],
};

export default config;
