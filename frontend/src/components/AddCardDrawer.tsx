import { Drawer, Form, Input, InputNumber, Button, Typography, AutoComplete, Tag, Divider, Space } from 'antd';
import { App as AntApp } from 'antd';
import { CreditCardOutlined, CheckOutlined } from '@ant-design/icons';
import { useCreateCard } from '../hooks/useData';
import { useIsMobile } from '../hooks/useIsMobile';
import { vndFormatter, vndParser } from '../lib/format';
import BankLogo from './BankLogo';
import type { Bank, CreditCard } from '../types';

const { Text } = Typography;

/** Mốc hạn mức nhập nhanh (VND). */
const QUICK_LIMITS = [10_000_000, 20_000_000, 50_000_000, 100_000_000, 200_000_000];

interface Props {
  open: boolean;
  banks: Bank[];
  /** Existing cards — used to flag card types already added per bank. */
  cards: CreditCard[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCardDrawer({ open, banks, cards, onClose, onSuccess }: Props) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
  const createMut = useCreateCard();
  const submitting = createMut.isPending;
  const selectedBankName = Form.useWatch('bank', form);
  const cardNameValue = Form.useWatch('cardName', form);
  const creditLimitValue = Form.useWatch('creditLimit', form);
  const selectedBank = banks.find(b => b.name === selectedBankName);

  // Progressive flow: bank → enables card type → enables credit limit → enables statement date.
  const hasBank = !!selectedBankName?.trim();
  const hasCardName = !!cardNameValue?.trim();
  const hasLimit = typeof creditLimitValue === 'number' && creditLimitValue > 0;

  // Card types already registered for the selected bank (case-insensitive).
  const usedLines = new Set(
    cards
      .filter(c => c.bank === selectedBankName)
      .map(c => c.cardName.trim().toLowerCase()),
  );

  const bankOptions = banks.map(b => {
    const count = cards.filter(c => c.bank === b.name).length;
    return {
      value: b.name,
      label: (
        <div className="flex items-center gap-2">
          <BankLogo name={b.name} logo={b.logo} color={b.color} size={22} />
          <span className="font-medium">{b.name}</span>
          <span className="text-gray-400 text-xs truncate flex-1">{b.fullName}</span>
          {count > 0 && <span className="text-blue-400 text-xs">{count} thẻ</span>}
        </div>
      ),
    };
  });

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async (values: { bank: string; cardName: string; creditLimit: number; statementDate: number }) => {
    const bank = values.bank.trim();
    const cardName = values.cardName.trim();
    // A bank may hold many cards, but each card type must be unique within it.
    if (cards.some(c => c.bank === bank && c.cardName.trim().toLowerCase() === cardName.toLowerCase())) {
      message.warning(`Thẻ "${cardName}" của ${bank} đã tồn tại`);
      return;
    }
    try {
      await createMut.mutateAsync({
        ...values,
        bank,
        cardName,
        creditLimit: Math.round(values.creditLimit),
      });
      message.success('Thêm thẻ thành công');
      form.resetFields();
      onSuccess();
    } catch {
      message.error('Lỗi khi thêm thẻ. Vui lòng thử lại.');
    }
  };

  return (
    <Drawer
      title="Thêm thẻ tín dụng"
      placement="right"
      width={isMobile ? '100%' : 420}
      open={open}
      onClose={handleClose}
      styles={{ body: { paddingBottom: 80 } }}
      extra={
        <Button type="primary" loading={submitting} onClick={() => form.submit()}>
          Lưu thẻ
        </Button>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="bank"
          label="Ngân hàng"
          rules={[{ required: true, message: 'Chọn hoặc nhập tên ngân hàng' }]}
        >
          <AutoComplete
            options={bankOptions}
            placeholder="Chọn ngân hàng hoặc nhập tên..."
            filterOption={(input, option) => {
              const text = input.toLowerCase();
              const b = banks.find(x => x.name === option?.value);
              if (!b) return true;
              return (
                b.name.toLowerCase().includes(text) ||
                b.fullName.toLowerCase().includes(text) ||
                b.code.toLowerCase().includes(text)
              );
            }}
            allowClear
          >
            <Input
              prefix={
                selectedBank ? (
                  <BankLogo name={selectedBank.name} logo={selectedBank.logo} color={selectedBank.color} size={18} />
                ) : undefined
              }
            />
          </AutoComplete>
        </Form.Item>

        {/* Card-line badges for the selected bank — click to fill the card name.
            Lines already added show a check and are disabled. */}
        {selectedBank && (selectedBank.creditCards?.length || selectedBank.cardBrands?.length) ? (
          <div className="-mt-2 mb-4">
            {selectedBank.creditCards && selectedBank.creditCards.length > 0 && (
              <>
                <Text type="secondary" className="text-xs">Dòng thẻ (chạm để chọn, có thể thêm nhiều thẻ):</Text>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {selectedBank.creditCards.map(line => {
                    const added = usedLines.has(line.toLowerCase());
                    return (
                      <Tag
                        key={line}
                        color={added ? 'default' : selectedBank.color}
                        icon={added ? <CheckOutlined /> : undefined}
                        className={added ? 'opacity-60' : 'cursor-pointer select-none'}
                        style={{ marginInlineEnd: 0 }}
                        onClick={added ? undefined : () => form.setFieldsValue({ cardName: line })}
                      >
                        {line}
                      </Tag>
                    );
                  })}
                </div>
              </>
            )}
            {selectedBank.cardBrands && selectedBank.cardBrands.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <Text type="secondary" className="text-xs">Tổ chức thẻ:</Text>
                {selectedBank.cardBrands.map(brand => (
                  <Tag key={brand} bordered={false} style={{ marginInlineEnd: 0 }}>{brand}</Tag>
                ))}
              </div>
            )}
            <Divider style={{ margin: '14px 0 4px' }} />
          </div>
        ) : null}

        <Form.Item
          name="cardName"
          label="Tên thẻ / loại thẻ"
          rules={[{ required: true, message: 'Nhập tên thẻ' }]}
          tooltip={!hasBank ? 'Chọn ngân hàng trước' : undefined}
        >
          <Input
            prefix={<CreditCardOutlined className="text-gray-300" />}
            placeholder={hasBank ? 'StepUp Mastercard, Shopee Credit...' : 'Chọn ngân hàng trước'}
            disabled={!hasBank}
          />
        </Form.Item>

        <Form.Item
          name="creditLimit"
          label="Hạn mức tín dụng (₫)"
          rules={[{ required: true, message: 'Nhập hạn mức' }, { type: 'number', min: 1, message: 'Hạn mức phải lớn hơn 0' }]}
          tooltip={!hasCardName ? 'Nhập tên thẻ trước' : undefined}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            step={1_000_000}
            precision={0}
            controls={false}
            formatter={vndFormatter}
            parser={vndParser}
            addonAfter="₫"
            placeholder="50.000.000"
            inputMode="numeric"
            disabled={!hasCardName}
          />
        </Form.Item>
        {hasCardName && (
          <div className="-mt-3 mb-4">
            <Space size={[6, 6]} wrap>
              {QUICK_LIMITS.map(v => (
                <Tag
                  key={v}
                  className="cursor-pointer select-none"
                  color="blue"
                  onClick={() => form.setFieldValue('creditLimit', v)}
                >
                  {(v / 1_000_000).toLocaleString('vi-VN')} triệu
                </Tag>
              ))}
            </Space>
          </div>
        )}

        <Form.Item
          name="statementDate"
          label="Ngày chốt sao kê"
          rules={[
            { required: true, message: 'Nhập ngày chốt' },
            { type: 'number', min: 1, max: 31, message: 'Ngày từ 1 đến 31' },
          ]}
          tooltip={!hasLimit ? 'Nhập hạn mức trước' : undefined}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={31}
            precision={0}
            placeholder="5"
            addonBefore="Ngày"
            addonAfter="hàng tháng"
            disabled={!hasLimit}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
