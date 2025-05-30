import React, { useCallback, useMemo } from 'react';
import { isString } from 'lodash';
import { hasDistinctValue } from 'mongodb-query-util';
import {
  Body,
  css,
  cx,
  spacing,
  palette,
  useDarkMode,
} from '@mongodb-js/compass-components';
import type { ChangeQueryFn } from '@mongodb-js/compass-query-bar';

import constants from '../constants/schema';

const { DECIMAL_128, DOUBLE, LONG, INT_32 } = constants;

const valueBubbleValueStyles = css({
  backgroundColor: palette.gray.light2,
  border: '1px solid transparent',
  color: palette.gray.dark3,
  padding: `${spacing[100] / 2} ${spacing[100]}`,
  borderRadius: spacing[100],
  '&:hover': {
    cursor: 'pointer',
  },
});

const valueBubblePreWrapStyles = css({
  whiteSpace: 'pre-wrap',
});

const valueBubbleDarkModeValueStyles = css({
  backgroundColor: palette.gray.dark2,
  color: palette.gray.light3,
});

const valueBubbleValueSelectedStyles = css({
  backgroundColor: palette.yellow.base,
  color: palette.gray.dark3,
});

/**
 * Converts the passed in value into a string, supports the 4 numeric
 * BSON types as well.
 */
function extractStringValue(value: any): string {
  if (value?._bsontype) {
    if ([DECIMAL_128, LONG].includes(value._bsontype)) {
      return value.toString();
    }
    if ([DOUBLE, INT_32].includes(value._bsontype)) {
      return String(value.value);
    }
  }
  if (isString(value)) {
    return value;
  }
  return String(value);
}

type ValueBubbleProps = {
  fieldName: string;
  queryValue: any;
  value: any;
  onQueryChanged: ChangeQueryFn;
};

function ValueBubble({
  fieldName,
  queryValue,
  value,
  onQueryChanged,
}: ValueBubbleProps) {
  const darkMode = useDarkMode();

  const onBubbleClicked = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onQueryChanged(e.shiftKey ? 'toggleDistinctValue' : 'setValue', {
        field: fieldName,
        value,
        unsetIfSet: true,
      });
    },
    [onQueryChanged, fieldName, value]
  );

  const extractedStringValue = useMemo(
    () => extractStringValue(value),
    [value]
  );
  const isValueInQuery: boolean = useMemo(
    () => hasDistinctValue(queryValue, value),
    [queryValue, value]
  );

  return (
    <li className="bubble">
      <Body>
        <button
          type="button"
          aria-label={`${
            isValueInQuery ? 'Remove' : 'Add'
          } ${extractedStringValue} ${isValueInQuery ? 'from' : 'to'} query`}
          className={cx(
            valueBubbleValueStyles,
            isString(value) && valueBubblePreWrapStyles,
            darkMode && valueBubbleDarkModeValueStyles,
            isValueInQuery && valueBubbleValueSelectedStyles
          )}
          onClick={onBubbleClicked}
        >
          {extractedStringValue}
        </button>
      </Body>
    </li>
  );
}

export { ValueBubble };
