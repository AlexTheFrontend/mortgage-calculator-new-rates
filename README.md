# Mortgage Refix Rate Calculator

A React-based mortgage calculator for NZ that helps compare current fixed rates against new refinancing options.

## Features

- Compare current vs. new mortgage rates
- Interactive rate slider for quick adjustments
- Real-time calculations of monthly and total interest savings
- Balance amortization chart
- Dark mode support
- Responsive design (mobile & desktop)

## Getting Started

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Production Build

```bash
npm run build
```

Builds the app for production to the `build` folder.

## Deployment

The app includes a `.htaccess` file for Apache servers that:
- Redirects the old static `index.html` to the React app with a 301 permanent redirect
- Routes all requests to the React app for client-side routing

## Technologies

- React 18
- Chart.js 4
- CSS3 with CSS Variables for theming

## Disclaimer

Indicative only. Assumes constant rate for the full term. Consult your bank or mortgage adviser before refixing.
