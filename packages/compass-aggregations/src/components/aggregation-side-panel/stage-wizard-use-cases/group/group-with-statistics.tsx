import {
  css,
  Body,
  Select,
  Option,
  spacing,
  ListEditor,
} from '@mongodb-js/compass-components';
import React, { useMemo, useState } from 'react';
import { connect } from 'react-redux';
import type { ACCUMULATORS, Completion } from '@mongodb-js/mongodb-constants';
import { getFilteredCompletions } from '@mongodb-js/mongodb-constants';
import type { Document } from 'mongodb';
import {
  getNextId,
  mapFieldToPropertyName,
  mapFieldsToAccumulatorValue,
} from '../utils';
import type { RootState } from '../../../../modules';
import type { WizardComponentProps } from '..';
import { FieldCombobox } from '../field-combobox';

type Accumulator = typeof ACCUMULATORS[number];

const ACCUMULATOR_LABELS = {
  $avg: 'Average',
  $min: 'Minimum',
  $stdDevPop: 'Standard Deviation',
  $count: 'Count',
  $max: 'Maximum',
  $sum: 'Sum',
} as const;

const SUPPORTED_ACCUMULATORS = Object.keys(ACCUMULATOR_LABELS);

type SupportedAccumulator = Extract<
  Accumulator,
  { value: keyof typeof ACCUMULATOR_LABELS }
>;

function isSupportedAccumulator(c: Completion): c is SupportedAccumulator {
  return SUPPORTED_ACCUMULATORS.includes(c.value);
}

const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
  width: 'max-content',
  maxWidth: '100%',
});

const groupRowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

const groupLabelStyles = css({
  minWidth: '100px',
  textAlign: 'right',
});

const LONGEST_ACCUMULATOR_LABEL = Math.max(
  ...Object.values(ACCUMULATOR_LABELS).map((label) => {
    return label.length;
  })
);

const selectStyles = css({
  width: `${String(LONGEST_ACCUMULATOR_LABEL)}ch`,
});
const accumulatorFieldcomboboxStyles = css({ width: '300px' });
const groupFieldscomboboxStyles = css({ width: '100%' });

type GroupOwnProps = WizardComponentProps;
type MapStateProps = { serverVersion: string };

type GroupAccumulators = {
  id: number;
  field: string;
  accumulator: string;
};

type GroupWithStatisticsFormData = {
  groupFields: string[];
  groupAccumulators: GroupAccumulators[];
};

const _getGroupAccumulatorKey = ({ field, accumulator }: GroupAccumulators) => {
  // we will always prepend an accumulator to the key as user
  // can choose to calculate values of the same field in a document.
  if (accumulator === '$count') {
    return 'count';
  }

  const prefix = accumulator.replace(/\$/g, '');
  const propertyName = mapFieldToPropertyName(field);
  const underscore = propertyName.startsWith('_') ? '' : '_';
  return [prefix, underscore, propertyName].join('');
};

const _getGroupAccumulatorValue = ({
  field,
  accumulator,
}: GroupAccumulators) => {
  return {
    [accumulator]: accumulator === '$count' ? {} : `$${field}`,
  };
};

const mapGroupFormStateToStageValue = (
  data: GroupWithStatisticsFormData
): Document => {
  const values = Object.fromEntries(
    data.groupAccumulators
      .filter((x) => x.accumulator && (x.accumulator === '$count' || x.field))
      .map((x) => [_getGroupAccumulatorKey(x), _getGroupAccumulatorValue(x)])
  );
  return {
    _id: mapFieldsToAccumulatorValue(data.groupFields),
    ...values,
  };
};

const GroupAccumulatorForm = ({
  fields,
  serverVersion,
  data,
  onChange,
}: {
  fields: WizardComponentProps['fields'];
  serverVersion: string;
  data: GroupAccumulators[];
  onChange: (value: GroupAccumulators[]) => void;
}) => {
  const onChangeGroup = <T extends keyof GroupAccumulators>(
    index: number,
    key: T,
    value: GroupAccumulators[T] | null
  ) => {
    if (!value) {
      return;
    }

    const newData = [...data];
    newData[index][key] = value;
    if (key === 'accumulator' && value === '$count') {
      newData[index].field = '';
    }

    onChange(newData);
  };

  const onAddItem = (at: number) => {
    const newData = [...data];
    newData.splice(at + 1, 0, {
      id: getNextId(),
      field: '',
      accumulator: '',
    });
    onChange(newData);
  };

  const onRemoveItem = (at: number) => {
    const newData = [...data];
    newData.splice(at, 1);
    onChange(newData);
  };

  const accumulators = useMemo(() => {
    return getFilteredCompletions({
      serverVersion,
      meta: ['accumulator'],
    })
      .filter(isSupportedAccumulator)
      .sort((a, b) => {
        return ACCUMULATOR_LABELS[a.value].localeCompare(
          ACCUMULATOR_LABELS[b.value]
        );
      });
  }, [serverVersion]);

  return (
    <div className={containerStyles}>
      <ListEditor
        items={data}
        onAddItem={(index) => onAddItem(index)}
        onRemoveItem={(index) => onRemoveItem(index)}
        itemKey={(item) => String(item.id)}
        renderItem={(item, index) => {
          return (
            <div className={groupRowStyles}>
              <Body className={groupLabelStyles}>
                {index === 0 ? 'Calculate' : 'and'}
              </Body>
              <Select
                className={selectStyles}
                allowDeselect={false}
                aria-label={'Select accumulator'}
                value={item.accumulator}
                onChange={(value: string) =>
                  onChangeGroup(index, 'accumulator', value)
                }
              >
                {accumulators.map((x) => {
                  return (
                    <Option value={x.value} key={x.value}>
                      {ACCUMULATOR_LABELS[x.value]}
                    </Option>
                  );
                })}
              </Select>
              {item.accumulator !== '$count' && (
                <>
                  <Body>of</Body>
                  <FieldCombobox
                    className={accumulatorFieldcomboboxStyles}
                    value={item.field}
                    onChange={(value: string | null) =>
                      onChangeGroup(index, 'field', value)
                    }
                    fields={fields}
                  />
                </>
              )}
            </div>
          );
        }}
      />
    </div>
  );
};

export const GroupWithStatistics = ({
  fields,
  serverVersion,
  onChange,
}: GroupOwnProps & MapStateProps) => {
  const [formData, setFormData] = useState<GroupWithStatisticsFormData>({
    groupFields: [],
    groupAccumulators: [
      {
        id: getNextId(),
        field: '',
        accumulator: '',
      },
    ],
  });

  const onChangeValue = <T extends keyof GroupWithStatisticsFormData>(
    key: T,
    value: GroupWithStatisticsFormData[T]
  ) => {
    const newData = {
      ...formData,
      [key]: value,
    };
    setFormData(newData);

    const isValuesEmpty =
      newData.groupAccumulators.filter(
        (x) => x.accumulator && (x.accumulator === '$count' || x.field)
      ).length === 0;

    onChange(
      JSON.stringify(mapGroupFormStateToStageValue(newData)),
      isValuesEmpty ? new Error('Select one group accumulator') : null
    );
  };

  return (
    <div className={containerStyles}>
      <GroupAccumulatorForm
        serverVersion={serverVersion}
        fields={fields}
        data={formData.groupAccumulators}
        onChange={(val) => onChangeValue('groupAccumulators', val)}
      />
      <div className={groupRowStyles}>
        <Body className={groupLabelStyles}>grouped by</Body>
        <FieldCombobox
          className={groupFieldscomboboxStyles}
          value={formData.groupFields}
          onChange={(val: string[]) => onChangeValue('groupFields', val)}
          fields={fields}
          multiselect={true}
        />
      </div>
    </div>
  );
};

export default connect(({ serverVersion }: RootState) => ({
  serverVersion,
}))(GroupWithStatistics);
