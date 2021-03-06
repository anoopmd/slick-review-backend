'use strict';

import Joi from 'joi';
import ProductEntity from '../entity/product';
import ProductRatingEntity from '../entity/product-rating';
import realtimeQueue from '../../realtime/queue';
import addReviewRequestSchema from '../schema/review';

/**
 * The Product Manager
 *
 * @class     ProductManager
 * @summary   Provides helper for CRUD ops on Products
 */
class ProductManager {
  /**
   * Constructor
   *
   * @param  {object} request - The request model
   * @summary initializes the ProductManager
   */
  constructor(request) {
    this.request = request;
  }

  /**
   * Validates add review request
   *
   * @param  {object} data - The data
   * @return {object}
   */
  async validateAddReviewRequest(data) {
    return new Promise((resolve, reject) => {
      let {error, value} = Joi.validate(data, addReviewRequestSchema, {abortEarly: false});

      if(error) {
        error.badRequest = true;
        return reject(error);
      }

      return resolve(value);
    });
  }

  /**
   * Gets all the products
   *
   * @async
   * @return {Promise}
   */
  async getAll() {
    try {
      let productEntity = new ProductEntity(this.request);
      let products = await productEntity.getAll();

      return products;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Find a product by id
   *
   * @async
   * @param  {Number} id  - The product id
   * @return {Promise}
   */
  async findById(id) {
    try {
      let productEntity = new ProductEntity(this.request);
      let productRatingEntity = new ProductRatingEntity(this.request);
      let product = await productEntity.findById(id);

      product.ratings = await productRatingEntity.getAllByProductId(id);

      return product;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Publish rating add event to realtime queue
   *
   * @async
   * @param  {string} event   - The event
   * @param  {object} payload - The payload
   * @return {Promise}
   */
  async publishToRealtimeQueue(event, payload) {
    await realtimeQueue.create(event, payload).save();
  }

  /**
   * Add product rating
   *
   * @async
   * @param  {Number} productId - The product id
   * @param  {Number} rating    - The product rating
   * @param  {String} review    - The product review
   * @return {Promise}
   */
  async addRating(productId, rating, review) {
    try {
      await this.validateAddReviewRequest({
        product_id: productId,
        rating: rating,
        review: review
      });

      let productRatingEntity = new ProductRatingEntity(this.request);
      let createdRatingId = await productRatingEntity.create(productId, rating, review);

      let createdRating = await productRatingEntity.findById(createdRatingId);

      await this.publishToRealtimeQueue('product-rating:added', {
        rating: createdRating,
        product_id: productId
      });

      return createdRating;
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

export default ProductManager;
