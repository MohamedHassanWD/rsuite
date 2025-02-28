import * as React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import compose from 'recompose/compose';
import {
  defaultProps,
  prefix,
  getUnhandledProps,
  createChainedFunction,
  getDataGroupBy,
  withPickerMethods
} from '../utils';

import {
  reactToString,
  filterNodesOfTree,
  findNodeOfTree,
  shallowEqual
} from 'rsuite-utils/lib/utils';

import {
  DropdownMenuItem,
  PickerToggle,
  PickerToggleTrigger,
  getToggleWrapperClassName,
  onMenuKeyDown,
  MenuWrapper,
  SearchBar
} from '../Picker';
import DropdownMenu, { dropdownMenuPropTypes } from '../Picker/DropdownMenu';
import { SelectPickerProps } from './SelectPicker.d';
import { PLACEMENT } from '../constants';
import { ItemDataType } from '../@types/common';

interface SelectPickerState {
  value?: any;
  // Used to focus the active item  when trigger `onKeydown`
  focusItemValue?: any;
  searchKeyword: string;
  active?: boolean;
}

class SelectPicker extends React.Component<SelectPickerProps, SelectPickerState> {
  static propTypes = {
    appearance: PropTypes.oneOf(['default', 'subtle']),
    data: PropTypes.array,
    locale: PropTypes.object,
    classPrefix: PropTypes.string,
    className: PropTypes.string,
    container: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
    containerPadding: PropTypes.number,
    block: PropTypes.bool,
    toggleComponentClass: PropTypes.elementType,
    menuClassName: PropTypes.string,
    menuStyle: PropTypes.object,
    menuAutoWidth: PropTypes.bool,
    disabled: PropTypes.bool,
    disabledItemValues: PropTypes.array,
    maxHeight: PropTypes.number,
    valueKey: PropTypes.string,
    labelKey: PropTypes.string,
    value: PropTypes.any,
    defaultValue: PropTypes.any,
    renderMenu: PropTypes.func,
    renderMenuItem: PropTypes.func,
    renderMenuGroup: PropTypes.func,
    renderValue: PropTypes.func,
    renderExtraFooter: PropTypes.func,
    onChange: PropTypes.func,
    onSelect: PropTypes.func,
    onGroupTitleClick: PropTypes.func,
    onSearch: PropTypes.func,
    onClean: PropTypes.func,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    onHide: PropTypes.func,
    onEnter: PropTypes.func,
    onEntering: PropTypes.func,
    onEntered: PropTypes.func,
    onExit: PropTypes.func,
    onExiting: PropTypes.func,
    onExited: PropTypes.func,
    /**
     * group by key in `data`
     */
    groupBy: PropTypes.any,
    sort: PropTypes.func,
    placeholder: PropTypes.node,
    searchable: PropTypes.bool,
    cleanable: PropTypes.bool,
    open: PropTypes.bool,
    defaultOpen: PropTypes.bool,
    placement: PropTypes.oneOf(PLACEMENT),
    style: PropTypes.object,
    /**
     * Prevent floating element overflow
     */
    preventOverflow: PropTypes.bool,
    virtualized: PropTypes.bool
  };
  static defaultProps = {
    appearance: 'default',
    data: [],
    disabledItemValues: [],
    maxHeight: 320,
    valueKey: 'value',
    labelKey: 'label',
    locale: {
      placeholder: 'Select',
      searchPlaceholder: 'Search',
      noResultsText: 'No results found'
    },
    placement: 'bottomStart',
    searchable: true,
    cleanable: true,
    menuAutoWidth: true,
    virtualized: true
  };
  positionRef: React.RefObject<any>;
  menuContainerRef: React.RefObject<any>;
  searchBarContainerRef: React.RefObject<any>;
  toggleRef: React.RefObject<any>;
  triggerRef: React.RefObject<any>;

  constructor(props: SelectPickerProps) {
    super(props);

    const { value, defaultValue, groupBy, valueKey, labelKey } = props;
    const nextValue = value || defaultValue;

    this.state = {
      value: nextValue,
      focusItemValue: nextValue,
      searchKeyword: ''
    };

    this.positionRef = React.createRef();
    this.menuContainerRef = React.createRef();
    this.toggleRef = React.createRef();
    this.triggerRef = React.createRef();

    // for test
    this.searchBarContainerRef = React.createRef();

    if (groupBy === valueKey || groupBy === labelKey) {
      throw Error('`groupBy` can not be equal to `valueKey` and `labelKey`');
    }
  }

  getFocusableMenuItems = () => {
    const { labelKey } = this.props;
    const { menuItems } = this.menuContainerRef.current;
    if (!menuItems) {
      return [];
    }

    const items = Object.values(menuItems).map((item: any) => item.props.getItemData());
    return filterNodesOfTree(items, item => this.shouldDisplay(item[labelKey]));
  };

  getValue() {
    const { value } = this.props;
    return _.isUndefined(value) ? this.state.value : value;
  }

  getToggleInstance = () => {
    return this.toggleRef.current;
  };

  getPositionInstance = () => {
    return this.positionRef.current;
  };

  /**
   * Index of keyword  in `label`
   * @param {node} label
   */
  shouldDisplay(label: any) {
    const { searchKeyword } = this.state;
    if (!_.trim(searchKeyword)) {
      return true;
    }

    const keyword = searchKeyword.toLocaleLowerCase();

    if (typeof label === 'string' || typeof label === 'number') {
      return `${label}`.toLocaleLowerCase().indexOf(keyword) >= 0;
    } else if (React.isValidElement(label)) {
      const nodes = reactToString(label);
      return (
        nodes
          .join('')
          .toLocaleLowerCase()
          .indexOf(keyword) >= 0
      );
    }

    return false;
  }

  findNode(focus: Function) {
    const items = this.getFocusableMenuItems();
    const { valueKey } = this.props;
    const { focusItemValue } = this.state;

    for (let i = 0; i < items.length; i += 1) {
      if (shallowEqual(focusItemValue, items[i][valueKey])) {
        focus(items, i);
        return;
      }
    }

    focus(items, -1);
  }
  focusNextMenuItem = () => {
    const { valueKey } = this.props;
    this.findNode((items, index) => {
      const focusItem = items[index + 1];
      if (!_.isUndefined(focusItem)) {
        this.setState({ focusItemValue: focusItem[valueKey] });
      }
    });
  };
  focusPrevMenuItem = () => {
    const { valueKey } = this.props;
    this.findNode((items, index) => {
      const focusItem = items[index - 1];
      if (!_.isUndefined(focusItem)) {
        this.setState({ focusItemValue: focusItem[valueKey] });
      }
    });
  };

  selectFocusMenuItem = (event: React.SyntheticEvent<any>) => {
    const { focusItemValue } = this.state;
    const { data, valueKey } = this.props;
    if (!focusItemValue) {
      return;
    }

    // Find active `MenuItem` by `value`
    const focusItem = findNodeOfTree(data, item => shallowEqual(item[valueKey], focusItemValue));

    this.setState({ value: focusItemValue });
    this.handleSelect(focusItemValue, focusItem, event);
    this.handleChange(focusItemValue, event);
    this.handleCloseDropdown();
  };

  handleKeyDown = (event: React.KeyboardEvent) => {
    const { focusItemValue, active } = this.state;

    // enter
    if ((!focusItemValue || !active) && event.keyCode === 13) {
      this.handleToggleDropdown();
    }

    // delete
    if (event.keyCode === 8 && event.target === this.toggleRef?.current?.getToggleNode?.()) {
      this.handleClean(event);
    }

    if (!this.menuContainerRef.current) {
      return;
    }

    onMenuKeyDown(event, {
      down: this.focusNextMenuItem,
      up: this.focusPrevMenuItem,
      enter: this.selectFocusMenuItem,
      esc: this.handleCloseDropdown
    });
  };

  handleItemSelect = (value: any, item: ItemDataType, event: React.SyntheticEvent<any>) => {
    const nextState = {
      value,
      focusItemValue: value
    };
    this.setState(nextState);
    this.handleSelect(value, item, event);
    this.handleChange(value, event);
    this.handleCloseDropdown();
  };

  handleSelect = (value: any, item: ItemDataType, event: React.SyntheticEvent<any>) => {
    this.props.onSelect?.(value, item, event);
    this.toggleRef.current?.onFocus();
  };

  handleSearch = (searchKeyword: string, event: React.SyntheticEvent<any>) => {
    this.setState({
      searchKeyword,
      focusItemValue: undefined
    });
    this.props.onSearch?.(searchKeyword, event);
  };

  handleCloseDropdown = () => {
    if (this.triggerRef.current) {
      this.triggerRef.current.hide();
    }
  };

  handleOpenDropdown = () => {
    if (this.triggerRef.current) {
      this.triggerRef.current.show();
    }
  };

  handleToggleDropdown = () => {
    const { active } = this.state;
    if (active) {
      this.handleCloseDropdown();
      return;
    }
    this.handleOpenDropdown();
  };

  handleChange = (value: any, event: React.SyntheticEvent<any>) => {
    this.props.onChange?.(value, event);
  };

  handleClean = (event: React.SyntheticEvent<any>) => {
    const { disabled, cleanable } = this.props;

    if (disabled || !cleanable) {
      return;
    }
    const nextState = {
      value: null,
      focusItemValue: null
    };

    this.setState(nextState);
    this.handleChange(null, event);
  };

  handleExit = () => {
    this.setState({
      searchKeyword: '',
      active: false
    });

    this.props.onClose?.();
  };

  handleOpen = () => {
    const value = this.getValue();

    this.setState({
      active: true,
      focusItemValue: value
    });

    this.props.onOpen?.();
  };

  addPrefix = (name: string) => prefix(this.props.classPrefix)(name);

  renderDropdownMenu() {
    const {
      data,
      labelKey,
      groupBy,
      searchable,
      locale,
      renderMenu,
      renderExtraFooter,
      menuClassName,
      menuStyle,
      menuAutoWidth,
      sort,
      virtualized
    } = this.props;

    const { focusItemValue } = this.state;
    const classes = classNames(this.addPrefix('select-menu'), menuClassName);

    let filteredData = filterNodesOfTree(data, item => this.shouldDisplay(item[labelKey]));

    // Create a tree structure data when set `groupBy`
    if (groupBy) {
      filteredData = getDataGroupBy(filteredData, groupBy, sort);
    } else if (typeof sort === 'function') {
      filteredData = filteredData.sort(sort(false));
    }

    const menuProps = _.pick(
      this.props,
      Object.keys(_.omit(dropdownMenuPropTypes, ['className', 'style', 'classPrefix']))
    );

    const menu = filteredData.length ? (
      <DropdownMenu
        {...menuProps}
        classPrefix={this.addPrefix('select-menu')}
        dropdownMenuItemClassPrefix={this.addPrefix('select-menu-item')}
        dropdownMenuItemComponentClass={DropdownMenuItem}
        ref={this.menuContainerRef}
        activeItemValues={[this.getValue()]}
        focusItemValue={focusItemValue}
        data={filteredData}
        group={!_.isUndefined(groupBy)}
        onSelect={this.handleItemSelect}
        virtualized={virtualized}
      />
    ) : (
      <div className={this.addPrefix('none')}>{locale.noResultsText}</div>
    );

    return (
      <MenuWrapper
        autoWidth={menuAutoWidth}
        className={classes}
        style={menuStyle}
        onKeyDown={this.handleKeyDown}
        getToggleInstance={this.getToggleInstance}
        getPositionInstance={this.getPositionInstance}
      >
        {searchable && (
          <SearchBar
            ref={this.searchBarContainerRef}
            placeholder={locale.searchPlaceholder}
            onChange={this.handleSearch}
            value={this.state.searchKeyword}
          />
        )}

        {renderMenu ? renderMenu(menu) : menu}
        {renderExtraFooter?.()}
      </MenuWrapper>
    );
  }

  render() {
    const {
      data,
      valueKey,
      labelKey,
      placeholder,
      renderValue,
      disabled,
      cleanable,
      locale,
      toggleComponentClass,
      style,
      onEntered,
      onExited,
      onClean,
      ...rest
    } = this.props;

    const unhandled = getUnhandledProps(SelectPicker, rest);
    const value = this.getValue();

    // Find active `MenuItem` by `value`
    const activeItem = findNodeOfTree(data, item => shallowEqual(item[valueKey], value));
    const hasValue = !!activeItem;

    let selectedElement: React.ReactNode = placeholder;

    if (activeItem?.[labelKey]) {
      selectedElement = activeItem[labelKey];

      if (renderValue) {
        selectedElement = renderValue(value, activeItem, selectedElement);
      }
    }

    const classes = getToggleWrapperClassName('select', this.addPrefix, this.props, hasValue);

    return (
      <PickerToggleTrigger
        pickerProps={this.props}
        ref={this.triggerRef}
        positionRef={this.positionRef}
        onEntered={createChainedFunction(this.handleOpen, onEntered)}
        onExit={createChainedFunction(this.handleExit, onExited)}
        speaker={this.renderDropdownMenu()}
      >
        <div className={classes} style={style} tabIndex={-1} role="menu">
          <PickerToggle
            {...unhandled}
            ref={this.toggleRef}
            onClean={createChainedFunction(this.handleClean, onClean)}
            onKeyDown={this.handleKeyDown}
            componentClass={toggleComponentClass}
            cleanable={cleanable && !disabled}
            hasValue={hasValue}
            active={this.state.active}
          >
            {selectedElement || locale.placeholder}
          </PickerToggle>
        </div>
      </PickerToggleTrigger>
    );
  }
}

const enhance = compose(
  defaultProps<SelectPickerProps>({
    classPrefix: 'picker'
  }),
  withPickerMethods<SelectPickerProps>()
);

export default enhance(SelectPicker);
