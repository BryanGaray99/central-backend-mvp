Feature: API Testing

  Background:
    Given I have a valid API client
    And I am authenticated


  @@smoke @@get
  Scenario: GET Product with valid data
    Given setup-product
    When get-product
    Then validate-product

  @@smoke @@post
  Scenario: POST Product with valid data
    Given setup-product
    When post-product
    Then validate-product

  @@smoke @@patch
  Scenario: PATCH Product with valid data
    Given setup-product
    When patch-product
    Then validate-product

  @@smoke @@delete
  Scenario: DELETE Product with valid data
    Given setup-product
    When delete-product
    Then validate-product
