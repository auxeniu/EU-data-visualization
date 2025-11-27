# Eurostat Data Visualization Project

A web-based data visualization application for exploring European Union statistics, featuring interactive charts, animations, and data tables built with vanilla JavaScript, SVG, and HTML5 Canvas.

## Project Overview

This is an academic project for a Multimedia course and it provides an interactive dashboard for visualizing key economic and demographic indicators from Eurostat, including GDP per capita, Life Expectancy, and Population data for EU member states. The application fetches real-time data from the Eurostat API and presents it through multiple visualization techniques.

## Project Structure

```
proiect-multimedia/
├── media/                          # Media files directory
│   └── eurostat.json              # Data file (to be downloaded)
├── template.html                   # Main HTML file
├── template.css                    # CSS stylesheet
├── template.js                     # JavaScript file
└── README.md                       # This file
```

## Features

### 1. Data Retrieval

- Automatic data fetching from Eurostat API on application startup
- Data sets:
  - `sdg_08_10?na_item=B1GQ&unit=CLV10_EUR_HAB` (GDP per capita)
  - `demo_mlexpec?sex=T&age=Y1` (Life Expectancy)
  - `demo_pjan?sex=T&age=TOTAL` (Population)
- Countries: BE, BG, CZ, DK, DE, EE, IE, EL, ES, FR, HR, IT, CY, LV, LT, LU, HU, MT, NL, AT, PL, PT, RO, SI, SK, FI, SE
- Last 15 available years

### 2. SVG Chart

- Display evolution for a selected indicator (GDP/Life Expectancy/Population) and country
- Chart type: line or bar chart (developer's choice)

### 3. SVG Tooltip

- Interactive tooltip displaying year and values for GDP/Life Expectancy/Population at mouse position

### 4. Canvas Bubble Chart

- Display bubble chart for a selected year
- Axes: GDP (X), Life Expectancy (Y), Population (bubble size)

### 5. Bubble Chart Animation

- Sequential display of bubble chart for all years

### 6. Color-Coded Data Table

- Display table for a selected year
- Countries as rows, indicators as columns
- Cell coloring from red to green based on distance from EU average

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- A local web server (for development) or web hosting

### Setup Instructions

1. **Rename Template Files:**

   - `template.html` → `CodTema_NrGrupa_NUME_Prenume.html`
   - `template.css` → `CodTema_NrGrupa_NUME_Prenume.css`
   - `template.js` → `CodTema_NrGrupa_NUME_Prenume.js`

2. **Update HTML References:**

   - Update CSS and JavaScript file references in the HTML file to match your renamed files

3. **Download Data File:**

   - Download `eurostat.json` from `http://ase.softmentor.ro/eurostat.json`
   - Save it in the `media/` folder

4. **Implement Functionality:**

   - Complete functions marked with `TODO` in `template.js`
   - Implement Eurostat API data retrieval
   - Implement SVG chart rendering
   - Implement tooltip functionality
   - Implement bubble chart
   - Implement animation
   - Implement color-coded table

5. **Test the Application:**
   - Ensure all functionalities work correctly
   - Test across different browsers

## API Usage Example

Example API call (2 countries, 2 years):

```
https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_mlexpec?sex=T&age=Y1&time=2019&time=2020&geo=RO&geo=BG
```

## Technical Requirements

- **JavaScript:** Vanilla JavaScript only (no external libraries)
- **CSS:** Bootstrap CSS is permitted (CSS only, no JavaScript components)
- **Code Standards:**
  - All code must be properly formatted and commented
  - JavaScript code must be written entirely by the developer
  - No JavaScript code from external sources is permitted (except course/seminar examples from online.ase.ro)
- **Media Files:** Media files, CSS, and data files may be sourced from anywhere

## Documentation

### Recommended Resources

- [Mozilla Developer Network](https://developer.mozilla.org/en-US/) - Web technologies reference
- [The Modern JavaScript Tutorial](https://javascript.info/) - JavaScript learning resource
- [Eurostat API Documentation](https://wikis.ec.europa.eu/display/EUROSTATHELP/API+Statistics+-+data+query) - Official API documentation
