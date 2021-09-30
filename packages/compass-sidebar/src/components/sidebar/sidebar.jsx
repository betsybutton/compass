import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import cloneDeep from 'lodash.clonedeep';
import ReactTooltip from 'react-tooltip';
import { AutoSizer, List } from 'react-virtualized';
import { globalAppRegistryEmit } from '@mongodb-js/mongodb-redux-common/app-registry';
import { ResizeHandle, ResizeDirection } from '@mongodb-js/compass-components';

import classnames from 'classnames';
import styles from './sidebar.module.less';

import SidebarTitle from '../sidebar-title';
import SidebarInstance from '../sidebar-instance';
import SidebarDatabase from '../sidebar-database';
import NonGenuineWarningModal from '../non-genuine-warning-modal';

import { toggleIsDetailsExpanded } from '../../modules/is-details-expanded';
import { toggleIsGenuineMongoDBVisible } from '../../modules/is-genuine-mongodb-visible';
import { filterDatabases, changeDatabases } from '../../modules/databases';
import { changeFilterRegex } from '../../modules/filter-regex';
import { openLink } from '../../modules/link';
import { toggleIsModalVisible } from '../../modules/is-modal-visible';
import { saveFavorite } from '../../modules/connection-model';

import { TOOLTIP_IDS } from '../../constants/sidebar-constants';

const OVER_SCAN_COUNT = 100;
const ROW_HEIGHT = 28;
const EXPANDED_WHITESPACE = 12;

// In pixels. (px)
const sidebarWidthCollapsed = 36;
const sidebarMinWidthOpened = 160;
const defaultSidebarWidthOpened = 250;
const sidebarArrowControlIncrement = 10;

function getMaxSidebarWidth() {
  return Math.max(sidebarMinWidthOpened, window.innerWidth - 100);
}

// Apply bounds to the sidebar width when resizing to ensure it's always
// visible and usable to the user.
function boundSidebarWidth(attemptedWidth) {
  const maxWidth = getMaxSidebarWidth();

  return Math.min(maxWidth, Math.max(sidebarMinWidthOpened, attemptedWidth));
}

class Sidebar extends PureComponent {
  static displayName = 'Sidebar';
  static propTypes = {
    databases: PropTypes.object.isRequired,
    description: PropTypes.string.isRequired,
    filterRegex: PropTypes.any.isRequired,
    instance: PropTypes.object.isRequired,
    isDetailsExpanded: PropTypes.bool.isRequired,
    isWritable: PropTypes.bool.isRequired,
    toggleIsDetailsExpanded: PropTypes.func.isRequired,
    detailsPlugins: PropTypes.array.isRequired,
    filterDatabases: PropTypes.func.isRequired,
    changeDatabases: PropTypes.func.isRequired,
    openLink: PropTypes.func.isRequired,
    changeFilterRegex: PropTypes.func.isRequired,
    isDataLake: PropTypes.bool.isRequired,
    isGenuineMongoDB: PropTypes.bool.isRequired,
    isGenuineMongoDBVisible: PropTypes.bool.isRequired,
    toggleIsGenuineMongoDBVisible: PropTypes.func.isRequired,
    globalAppRegistryEmit: PropTypes.func.isRequired,
    connectionModel: PropTypes.object.isRequired,
    toggleIsModalVisible: PropTypes.func.isRequired,
    isModalVisible: PropTypes.bool.isRequired,
    saveFavorite: PropTypes.func.isRequired
  };

  state = {
    width: defaultSidebarWidthOpened,
    prevWidth: defaultSidebarWidthOpened
  };

  componentWillReceiveProps() {
    if (this.list) {
      this.list.recomputeRowHeights();
    }
  }

  componentDidUpdate() {
    // Re-render tooltips once data has been fetched from mongo/d/s in a
    // performant way for data.mongodb.parts (~1500 collections)
    ReactTooltip.rebuild();
  }

  updateWidth(width) {
    this.setState(
      (width > sidebarMinWidthOpened)
        ? {
          width,
          // Store the previous width to use when toggling open/close
          // when we resize while the sidebar is expanded.
          prevWidth: width
        } : {
          width
        }
    );
  }

  handleSearchFocus() {
    if (this.state.width < sidebarMinWidthOpened) {
      // Expand the sidebar when it's collapsed and search is clicked.
      this.updateWidth(this.state.prevWidth);
    }

    this.refs.filter.focus();
  }

  handleFilter(event) {
    const searchString = event.target.value;

    let re;
    try {
      re = new RegExp(searchString, 'i');
    } catch (e) {
      re = /(?:)/;
    }

    this.props.changeFilterRegex(re);
    this.props.filterDatabases(re, null, null);
  }

  handleCreateDatabaseClick(isWritable) {
    if (isWritable) {
      this.props.globalAppRegistryEmit('open-create-database');
    }
  }

  _calculateRowHeight({index}) {
    const db = this.props.databases.databases[index];
    let height = ROW_HEIGHT;
    if (this.props.databases.expandedDblist[db._id]) {
      height += db.collections.length * ROW_HEIGHT + EXPANDED_WHITESPACE;
    }
    return height;
  }

  /**
   * Set the reference of the List object to call public methods of react-virtualized
   * see link: https://github.com/bvaughn/react-virtualized/blob/master/docs/List.md#public-methods
   *
   * @param{Object} ref the react-virtualized.List reference used here
   */
  _setRef(ref) {
    this.list = ref;
  }

  /**
   * Display while sidebar list is being loaded
   * @return {DOM} element
   */
  retrievingDatabases() {
    return null;
  }

  isReadonlyDistro() {
    return process.env.HADRON_READONLY === 'true';
  }

  /**
   * On expand/collapse of sidebar-database, add/remove from expandedDblists state and recompute row heights
   * @param{string} _id sidebar-database _id
   */
  _onDBClick(_id) {
    const expandedDB = cloneDeep(this.props.databases.expandedDblist);
    expandedDB[_id] = !expandedDB[_id];
    this.props.changeDatabases(this.props.databases.databases, expandedDB, this.props.databases.activeNamespace);
    this.list.recomputeRowHeights();
  }

  renderCreateDatabaseButton() {
    if (!this.isReadonlyDistro() && !this.props.isDataLake) {
      const tooltipText = this.props.description;
      const tooltipOptions = this.props.isWritable ? {} : {
        'data-for': TOOLTIP_IDS.CREATE_DATABASE_BUTTON,
        'data-effect': 'solid',
        'data-place': 'right',
        'data-offset': "{'right': -10}",
        'data-tip': tooltipText
      };
      const isW = !this.props.isWritable ? styles['compass-sidebar-button-is-disabled'] : '';
      const className = classnames(styles['compass-sidebar-button-create-database'], styles[isW]);
      return (
        <div
          className={classnames(styles['compass-sidebar-button-create-database-container'])}
          {...tooltipOptions}>
          <button
            className={className}
            title="Create Database"
            onClick={this.handleCreateDatabaseClick.bind(this, this.props.isWritable)}>
            <i className="mms-icon-add" />
            <div className={classnames(styles['plus-button'])}>
              Create Database
            </div>
          </button>
        </div>
      );
    }
  }

  renderSidebarDatabase({index, key, style}) {
    const db = this.props.databases.databases[index];
    const props = {
      isWritable: this.props.isWritable,
      description: this.props.description,
      _id: db._id,
      activeNamespace: this.props.databases.activeNamespace,
      collections: db.collections,
      expanded: this.props.databases.expandedDblist[db._id],
      onClick: this._onDBClick.bind(this),
      globalAppRegistryEmit: this.props.globalAppRegistryEmit,
      key,
      style,
      index,
      isDataLake: this.props.isDataLake
    };
    return (
      <SidebarDatabase {...props} />
    );
  }

  renderSidebarScroll() {
    return (
      <AutoSizer>
        {({height, width}) => (
          <List
            width={width}
            height={height}
            className="compass-sidebar-autosizer-list"
            overScanRowCount={OVER_SCAN_COUNT}
            rowCount={this.props.databases.databases.length}
            rowHeight={this._calculateRowHeight.bind(this)}
            noRowsRenderer={this.retrievingDatabases}
            rowRenderer={this.renderSidebarDatabase.bind(this)}
            ref={this._setRef.bind(this)}
          />
        )}
      </AutoSizer>
    );
  }

  render() {
    const { width, prevWidth } = this.state;

    const isExpanded = width > sidebarMinWidthOpened;
    const renderedWidth = isExpanded ? boundSidebarWidth(width) : sidebarWidthCollapsed;

    const collapsedButton = 'fa' +
      (isExpanded ? ' fa-caret-left' : ' fa-caret-right');

    return (
      <div
        className={classnames(styles['compass-sidebar'], {
          [styles['compass-sidebar-collapsed']]: !isExpanded
        })}
        data-test-id="compass-sidebar-panel"
        style={{ width: renderedWidth }}
      >
        <ResizeHandle
          onChange={(newWidth) => this.updateWidth(newWidth)}
          direction={ResizeDirection.RIGHT}
          step={sidebarArrowControlIncrement}
          value={width}
          minValue={sidebarWidthCollapsed}
          maxValue={getMaxSidebarWidth()}
          title="sidebar"
        />
        <button
          className={classnames(styles['compass-sidebar-toggle'], 'btn btn-default btn-sm')}
          onClick={() => isExpanded
            ? this.updateWidth(sidebarWidthCollapsed)
            : this.updateWidth(prevWidth)
          }
          data-test-id="toggle-sidebar"
        >
          <i className={collapsedButton}/>
        </button>
        <SidebarTitle
          connectionModel={this.props.connectionModel}
          isSidebarExpanded={isExpanded}
          globalAppRegistryEmit={this.props.globalAppRegistryEmit}
        />
        {isExpanded && (
          <SidebarInstance
            instance={this.props.instance}
            isExpanded={this.props.isDetailsExpanded}
            detailsPlugins={this.props.detailsPlugins}
            isGenuineMongoDB={this.props.isGenuineMongoDB}
            toggleIsDetailsExpanded={this.props.toggleIsDetailsExpanded}
            globalAppRegistryEmit={this.props.globalAppRegistryEmit}
            connectionModel={this.props.connectionModel}
            toggleIsModalVisible={this.props.toggleIsModalVisible}
            isModalVisible={this.props.isModalVisible}
            saveFavorite={this.props.saveFavorite}
          />
        )}
        <div
          className={styles['compass-sidebar-filter']}
          onClick={this.handleSearchFocus.bind(this)}
        >
          <i className={classnames('fa', 'fa-search', styles['compass-sidebar-search-icon'])}/>
          <input
            data-test-id="sidebar-filter-input"
            ref="filter"
            className={styles['compass-sidebar-search-input']}
            placeholder="Filter your data"
            onChange={this.handleFilter.bind(this)}
          />
        </div>
        {isExpanded && (
          <div className={styles['compass-sidebar-content']}>
            {this.renderSidebarScroll()}
          </div>
        )}
        <NonGenuineWarningModal
          isVisible={this.props.isGenuineMongoDBVisible}
          toggleIsVisible={this.props.toggleIsGenuineMongoDBVisible}
          openLink={this.props.openLink}
        />
        {this.renderCreateDatabaseButton()}
        <ReactTooltip id={TOOLTIP_IDS.CREATE_DATABASE_BUTTON} />
        <ReactTooltip id={TOOLTIP_IDS.CREATE_COLLECTION} />
        <ReactTooltip id={TOOLTIP_IDS.DROP_DATABASE} />
        <ReactTooltip id={TOOLTIP_IDS.DROP_COLLECTION} />
      </div>
    );
  }
}

/**
 * Map the store state to properties to pass to the components.
 *
 * @param {Object} state - The store state.
 *
 * @returns {Object} The mapped properties.
 */
const mapStateToProps = (state) => ({
  databases: state.databases,
  description: state.description,
  detailsPlugins: state.detailsPlugins,
  filterRegex: state.filterRegex,
  instance: state.instance,
  isDblistExpanded: state.isDblistExpanded,
  isDetailsExpanded: state.isDetailsExpanded,
  isWritable: state.isWritable,
  isDataLake: state.isDataLake,
  isGenuineMongoDB: state.isGenuineMongoDB,
  isGenuineMongoDBVisible: state.isGenuineMongoDBVisible,
  connectionModel: state.connectionModel,
  isModalVisible: state.isModalVisible
});

/**
 * Connect the redux store to the component.
 * (dispatch)
 */
const MappedSidebar = connect(
  mapStateToProps,
  {
    toggleIsDetailsExpanded,
    toggleIsGenuineMongoDBVisible,
    filterDatabases,
    changeDatabases,
    changeFilterRegex,
    openLink,
    globalAppRegistryEmit,
    toggleIsModalVisible,
    saveFavorite
  },
)(Sidebar);

export default MappedSidebar;
export { Sidebar };
