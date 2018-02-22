import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import reducer from 'modules';
import toNS from 'mongodb-ns';
import { namespaceChanged } from 'modules/namespace';
import { dataServiceConnected } from 'modules/data-service';
import { fieldsChanged } from 'modules/fields';
import { refreshInputDocuments } from 'modules/input-documents';

/**
 * The store has a combined pipeline reducer plus the thunk middleware.
 */
const store = createStore(reducer, applyMiddleware(thunk));

/**
 * This hook is Compass specific to listen to app registry events.
 *
 * @param {AppRegistry} appRegistry - The app registry.
 */
store.onActivated = (appRegistry) => {
  /**
   * When the collection is changed, update the store.
   *
   * @param {String} ns - The full namespace.
   */
  appRegistry.on('collection-changed', (ns) => {
    const namespace = toNS(ns);
    if (namespace.collection) {
      store.dispatch(namespaceChanged(ns));
      store.dispatch(refreshInputDocuments());
    }
  });

  /**
   * Set the data service in the store when connected.
   *
   * @param {Error} error - The error.
   * @param {DataService} dataService - The data service.
   */
  appRegistry.on('data-service-connected', (error, dataService) => {
    store.dispatch(dataServiceConnected(error, dataService));
  });

  /**
   * When the schema fields change, update the state with the new
   * fields.
   *
   * @param {Object} fields - The fields.
   */
  appRegistry.getStore('Field.Store').listen((fields) => {
    store.dispatch(fieldsChanged(fields.fields));
  });
};

export default store;
