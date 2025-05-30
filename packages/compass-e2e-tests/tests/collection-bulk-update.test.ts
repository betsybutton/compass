import { expect } from 'chai';
import type { CompassBrowser } from '../helpers/compass-browser';
import {
  deleteCommonVariedProperties,
  startTelemetryServer,
} from '../helpers/telemetry';
import type { Telemetry } from '../helpers/telemetry';
import {
  init,
  cleanup,
  screenshotIfFailed,
  skipForWeb,
  DEFAULT_CONNECTION_NAME_1,
} from '../helpers/compass';
import type { Compass } from '../helpers/compass';
import * as Selectors from '../helpers/selectors';
import { createNumbersCollection } from '../helpers/insert-data';

describe('Bulk Update', () => {
  let compass: Compass;
  let browser: CompassBrowser;
  let telemetry: Telemetry;

  before(async function () {
    telemetry = await startTelemetryServer();
    compass = await init(this.test?.fullTitle());
    browser = compass.browser;
    await browser.setupDefaultConnections();
  });

  after(async function () {
    await cleanup(compass);
    await telemetry.stop();
  });

  beforeEach(async function () {
    await createNumbersCollection();
    await browser.disconnectAll();
    await browser.connectToDefaults();
    await browser.navigateToCollectionTab(
      DEFAULT_CONNECTION_NAME_1,
      'test',
      'numbers',
      'Documents'
    );
  });

  afterEach(async function () {
    await screenshotIfFailed(compass, this.currentTest);
  });

  it('updates documents matching a filter', async function () {
    const telemetryEntry = await browser.listenForTelemetryEvents(telemetry);

    // Set a query that we'll use.
    await browser.runFindOperation('Documents', '{ i: 5 }');

    // Open the modal.
    await browser.clickVisible(Selectors.OpenBulkUpdateButton);
    await browser.$(Selectors.BulkUpdateModal).waitForDisplayed();

    // Check the telemetry
    const openedEvent = await telemetryEntry('Bulk Update Opened');

    deleteCommonVariedProperties(openedEvent);

    expect(openedEvent).to.deep.equal({
      isUpdatePreviewSupported: true,
    });

    // Make sure the query is shown in the modal.
    expect(
      await browser.$(Selectors.BulkUpdateReadonlyFilter).getText()
    ).to.equal('{ i: 5 }');

    // Check that it will update the expected number of documents
    expect(await browser.$(Selectors.BulkUpdateTitle).getText()).to.equal(
      'Update 1 document'
    );
    expect(
      await browser.$(Selectors.BulkUpdateUpdateButton).getText()
    ).to.equal('Update 1 document');

    // Check that the modal starts with the default update text
    expect(
      await browser.getCodemirrorEditorText(Selectors.BulkUpdateUpdate)
    ).to.match(/{\s+\$set:\s+{\s+},?\s+}/);

    // Change the update text
    await browser.setCodemirrorEditorValue(
      Selectors.BulkUpdateUpdate,
      '{ $set: { foo: "bar" } }'
    );

    // Wait for the preview to update accordingly
    await browser.waitUntil(async () => {
      const text = await browser
        .$(Selectors.BulkUpdatePreviewDocument + ':first-child')
        .getText();
      console.log(text);
      return /foo\s*:\s+"bar"/.test(text);
    });

    // Press update
    await browser.clickVisible(Selectors.BulkUpdateUpdateButton);

    // The modal should go away
    await browser
      .$(Selectors.BulkUpdateModal)
      .waitForDisplayed({ reverse: true });

    // The success toast is displayed
    await browser.$(Selectors.BulkUpdateSuccessToast).waitForDisplayed();

    const toastText = await browser
      .$(Selectors.BulkUpdateSuccessToast)
      .getText();

    expect(toastText).to.contain('1 document has been updated.');
    // We close the toast
    await browser.clickVisible(Selectors.BulkUpdateSuccessToastDismissButton);

    await browser
      .$(Selectors.BulkUpdateSuccessToast)
      .waitForDisplayed({ reverse: true });

    // Check the telemetry
    const executedEvent = await telemetryEntry('Bulk Update Executed');

    deleteCommonVariedProperties(executedEvent);

    expect(executedEvent).to.deep.equal({
      isUpdatePreviewSupported: true,
    });

    await browser.runFindOperation('Documents', '{ i: 5, foo: "bar" }');
    const modifiedDocument = browser.$(Selectors.DocumentListEntry);
    await modifiedDocument.waitForDisplayed();
    const doc = await getFormattedDocument(browser);
    return /^_id: ObjectId\('[a-f0-9]{24}'\) i: 5 j: 0 foo: "bar"$/.test(doc);
  });

  it('can save an update query as a favourite and return to it', async function () {
    skipForWeb(this, "can't use saved queries in compass-web yet");

    const telemetryEntry = await browser.listenForTelemetryEvents(telemetry);

    // Set a query that we'll use.
    await browser.runFindOperation('Documents', '{ i: { $gt: 5 } }');

    // Open the modal.
    await browser.clickVisible(Selectors.OpenBulkUpdateButton);
    await browser.$(Selectors.BulkUpdateModal).waitForDisplayed();

    // Change the update text
    await browser.setCodemirrorEditorValue(
      Selectors.BulkUpdateUpdate,
      '{ $set: { k: 0 } }'
    );

    // Click save to open the popover
    await browser.clickVisible(Selectors.BulkUpdateSaveFavorite);

    // Fill in a name
    await browser.setValueVisible(
      Selectors.BulkUpdateFavouriteNameInput,
      'My Update Query'
    );

    // Click save to save the query
    await browser.$(Selectors.BulkUpdateFavouriteSaveButton).waitForEnabled();
    await browser.clickVisible(Selectors.BulkUpdateFavouriteSaveButton);

    // Check the telemetry
    const favoritedEvent = await telemetryEntry('Bulk Update Favorited');

    deleteCommonVariedProperties(favoritedEvent);

    expect(favoritedEvent).to.deep.equal({
      isUpdatePreviewSupported: true,
    });

    // Close the modal
    await browser.clickVisible(Selectors.BulkUpdateCancelButton);

    // Wait for the modal to go away
    await browser
      .$(Selectors.BulkUpdateModal)
      .waitForDisplayed({ reverse: true });

    // Open the dropdown
    await browser.clickVisible(Selectors.QueryBarHistoryButton);

    // Wait for the popover to show
    await browser.$(Selectors.QueryBarHistory).waitForDisplayed();

    // Browse to Favourites
    await browser.clickVisible(Selectors.FavouriteQueriesButton);

    // Wait for the favourite to show and click it
    await browser.waitUntil(async () => {
      const favouriteElements = browser.$$(Selectors.FavouriteQueryListItem);
      for await (const element of favouriteElements) {
        const favouriteName = await element
          .$(Selectors.FavouriteQueryTitle)
          .getText();
        console.log(favouriteName);
        if (favouriteName === 'My Update Query') {
          await element.click();
          return true;
        }
      }
      return false;
    });

    // The modal should open
    await browser.$(Selectors.BulkUpdateModal).waitForDisplayed();

    // Make sure the query is shown in the modal.
    expect(
      await browser.$(Selectors.BulkUpdateReadonlyFilter).getText()
    ).to.match(/{\s+i:\s+{\s+\$gt:\s+5\s+}\s+}/);

    // Check that the modal starts with the expected update text
    expect(
      await browser.getCodemirrorEditorText(Selectors.BulkUpdateUpdate)
    ).to.match(/{\s+\$set:\s+{\s+k:\s+0\s+}\s+}/);
  });
});

async function getFormattedDocument(browser: CompassBrowser): Promise<string> {
  const document = browser.$(Selectors.DocumentListEntry);
  await document.waitForDisplayed();
  return (await document.getText())
    .replace(/\n/g, ' ')
    .replace(/\s+?:/g, ':')
    .replace(/\s+/g, ' ');
}
