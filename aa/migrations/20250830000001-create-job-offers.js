'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('JobOffers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      company: {
        type: Sequelize.STRING,
        allowNull: false
      },
      location: {
        type: Sequelize.STRING,
        allowNull: false
      },
      salary_min: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      salary_max: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      contract_type: {
        type: Sequelize.ENUM('CDI', 'CDD', 'Stage', 'Freelance', 'Apprentissage'),
        allowNull: false,
        defaultValue: 'CDI'
      },
      work_mode: {
        type: Sequelize.ENUM('Présentiel', 'Télétravail', 'Hybride', 'Flexible'),
        allowNull: false,
        defaultValue: 'Hybride'
      },
      application_deadline: {
        type: Sequelize.DATE,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      requirements: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      benefits: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      job_description_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'JobDescriptions',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'closed'),
        allowNull: false,
        defaultValue: 'draft'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      views_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      applications_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('JobOffers');
  }
};