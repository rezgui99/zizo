"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajouter les contraintes de clés étrangères pour les auto-références
    await queryInterface.addConstraint("JobDescriptions", {
      fields: ["superieur_n1"],
      type: "foreign key",
      name: "fk_job_descriptions_superieur_n1",
      references: {
        table: "JobDescriptions",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("JobDescriptions", {
      fields: ["superieur_n2"],
      type: "foreign key",
      name: "fk_job_descriptions_superieur_n2", 
      references: {
        table: "JobDescriptions",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("JobDescriptions", "fk_job_descriptions_superieur_n1");
    await queryInterface.removeConstraint("JobDescriptions", "fk_job_descriptions_superieur_n2");
  },
};