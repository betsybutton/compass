const _ = require('lodash');
const React = require('react');
const PropTypes = require('prop-types');
const Document = require('./document');

/**
 * The full document list container class.
 */
const LIST_CLASS = 'document-list';

/**
 * The list item class.
 */
const LIST_ITEM_CLASS = `${LIST_CLASS}-item`;

/**
 * The list item test id.
 */
const LIST_ITEM_TEST_ID = LIST_ITEM_CLASS;

/**
 * Represents the list view of the documents tab.
 */
class DocumentListView extends React.Component {

  /**
   * Get the document list item components.
   *
   * @param {Array} docs - The raw documents.
   *
   * @return {Array} The document list item components.
   */
  renderDocuments() {
    return _.map(this.props.docs, (doc, i) => {
      return (
        <li className={LIST_ITEM_CLASS} data-test-id={LIST_ITEM_TEST_ID} key={i}>
          <Document
            doc={doc}
            key={i}
            editable={this.props.isEditable}
            documentRemoved={this.props.documentRemoved}
            openInsertDocumentDialog={this.props.openInsertDocumentDialog}
            closeAllMenus={this.props.closeAllMenus} />
        </li>
      );
    });
  }

  /**
   * Render the document list view.
   *
   * @returns {React.Component} The component.
   */
  render() {
    return (
      <ol className={LIST_CLASS}>
        {this.renderDocuments()}
      </ol>
    );
  }
}

DocumentListView.propTypes = {
  docs: PropTypes.array.isRequired,
  isEditable: PropTypes.bool.isRequired,
  documentRemoved: PropTypes.func.isRequired,
  openInsertDocumentDialog: PropTypes.func.isRequired,
  closeAllMenus: PropTypes.func.isRequired
};

DocumentListView.displayName = 'DocumentListView';

module.exports = DocumentListView;
