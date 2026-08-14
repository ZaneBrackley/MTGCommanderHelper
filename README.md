# MTG Commander Helper

MTG Commander Helper is a small React project I built to make finding commanders and completing the Commander 32-Deck Challenge easier.

The app lets you browse current Commander-legal cards, filter them by colour identity and strategy, and assign commanders to each of the 32 possible colour identities.

## Features

* Search for commanders by name
* Filter by exact colour identity
* Filter using deck themes and strategy tags
* Sort alphabetically or by EDHREC rank
* View card images and links to Scryfall and EDHREC
* Support for Partner With commanders
* Support for transform and double-faced cards
* Assign commanders to the 32-Deck Challenge
* Save challenge selections in the browser
* Update the commander catalogue directly from Scryfall

The current catalogue contains over 3,400 Commander-legal cards and can be refreshed as new sets are released.

## 32-Deck Challenge

The Commander 32-Deck Challenge involves choosing a commander or partner pair for every possible colour identity in Magic:

* Five mono-colour identities
* Ten two-colour identities
* Ten three-colour identities
* Five four-colour identities
* Five-colour
* Colourless

Commanders can be assigned from the Search page and viewed or removed from the 32-Deck Challenge page.

Challenge progress is saved using browser local storage, so it will still be there when you return to the site on the same browser.

## Built With

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* Scryfall API
* Archidekt deck data

## Running the Project Locally

Clone the repository:

```bash
git clone https://github.com/ZaneBrackley/MTGCommanderHelper.git
```

Move into the project folder:

```bash
cd MTGCommanderHelper
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will display a local address, usually:

```text
http://localhost:5173/MTGCommanderHelper/
```

## Updating the Commander Data

The commander list can be refreshed from inside the app using the **Update Commander List** button.

You can also rebuild the bundled commander catalogue with:

```bash
npm run build:data
```

The build script requests all paper Commander-legal cards from Scryfall and saves them to:

```text
public/commanders.json
```

## Building for Production

Create a production build with:

```bash
npm run build
```

Preview the production build locally with:

```bash
npm run preview
```

## Data Sources

Card information, images, colour identities, legality information and EDHREC links are provided through the [Scryfall API](https://scryfall.com/docs/api).

Commander strategy tags are generated using public Commander deck information from [Archidekt](https://archidekt.com/).

This project is not affiliated with or endorsed by Wizards of the Coast, Scryfall, EDHREC or Archidekt.

Magic: The Gathering and its associated properties are owned by Wizards of the Coast.

## Author

Created by [Zane Brackley](https://github.com/ZaneBrackley).
