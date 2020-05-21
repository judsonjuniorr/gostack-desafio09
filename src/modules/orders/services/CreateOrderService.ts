import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) throw new AppError('Customer not found');

    const productsId = products.map(product => ({ id: product.id }));
    const productsStore = await this.productsRepository.findAllById(productsId);

    if (products.length !== productsStore.length)
      throw new AppError('One or more products specified are invalid');

    const productsOutOfStock = products.filter(product => {
      const storeProduct = productsStore.find(
        productStore => productStore.id === product.id,
      );

      const stock = (storeProduct?.quantity || 0) - product.quantity;

      return stock < 0;
    });

    if (productsOutOfStock.length > 0)
      throw new AppError('One or more products specified is out of stock');

    const orderedProducts = productsStore.map(orderedProduct => {
      const product = products.find(prod => prod.id === orderedProduct.id);

      return {
        product_id: orderedProduct.id,
        price: orderedProduct.price,
        quantity: product?.quantity || 0,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderedProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
