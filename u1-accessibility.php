<?php
/**
 * Plugin Name: U1 Accessibility Wizard
 * Description: v6.0 - Final Stable Release (Protected Container Edition).
 * Version: 6.0.5
 * Author: U1
 */

if (!defined('ABSPATH')) exit;

define('U1W_VERSION', '6.0.5');

class U1_Accessibility_Wizard {
  private $option_name = 'u1_accessibility_config';

  public function __construct() {
    register_activation_hook(__FILE__, [$this, 'on_activate']);
    add_action('wp_enqueue_scripts', [$this, 'enqueue_front'], 20);
    add_action('admin_bar_menu', [$this, 'add_admin_bar_link'], 100);
    add_action('wp_ajax_u1_wizard_get_config', [$this, 'ajax_get_config']);
    add_action('wp_ajax_u1_wizard_save_config', [$this, 'ajax_save_config']);
  }

  public function on_activate() {
    if (get_option($this->option_name, null) === null) {
      update_option($this->option_name, $this->get_default_config());
    }
  }

  private function is_wizard_mode() {
    if (is_admin()) return false;
    if (!is_user_logged_in()) return false;
    if (!current_user_can('manage_options')) return false;
    return isset($_GET['u1wizard']) && ($_GET['u1wizard'] === '1' || $_GET['u1wizard'] === 1);
  }

  private function get_default_config() {
    return [
      'init' => [
        'js_url' => 'https://prd.release.user1st.com/u1_vanilla-js-a11y.js',
        'css_url' => 'https://prd.release.user1st.com/u1.css',
        'focus_color' => '#000000',
        'focus_secondary_color' => '#ffffff',
        'focus_double' => false,
        'skiplinks_enabled' => true,
      ],
      'skiplinks' => [],
      'button' => [], 'link' => [], 'menu' => [], 'form' => [], 'accordion' => [],
      'tabs' => [], 'dialog' => [], 'carousel' => [],
      'static_fixes' => []
    ];
  }

  public function enqueue_front() {
    $defaults = $this->get_default_config();
    $cfg = get_option($this->option_name, $defaults);
    $plugin_url = plugin_dir_url(__FILE__);

    // 1. Core CSS
    if (!empty($cfg['init']['css_url'])) {
        wp_enqueue_style('u1-core-css', $cfg['init']['css_url'], [], null);
    }
    
    // 2. Engine JS
    if (!empty($cfg['init']['js_url'])) {
        wp_enqueue_script('u1-external-engine', $cfg['init']['js_url'], [], null, true);
    }
    
    // 3. Skip Links CSS (Targeting the new Protected ID)
    wp_register_style('u1w-skiplinks', false, [], U1W_VERSION);
    wp_enqueue_style('u1w-skiplinks');
    wp_add_inline_style('u1w-skiplinks', '
      /* הסתרה גלובלית לכל מה שחשוד כסקיפ-לינק */
      .skip-link, .skiplink, .screen-reader-text a, #ast-skip-link {
          display: none !important;
      }

      /* החרגה והגנה על הקונטיינר שלנו */
      #u1-wizard-skiplinks-wrapper {
          position: fixed; 
          top: 0; 
          left: 0; 
          width: 100%; 
          z-index: 2147483647; 
          pointer-events: none;
          display: block !important; /* דורס כל הסתרה חיצונית */
      }

      #u1-wizard-skiplinks-wrapper a {
        position: absolute; 
        top: -999px; 
        left: 50%; 
        transform: translateX(-50%);
        background: #000; 
        color: #fff; 
        padding: 15px 25px; 
        font-weight: bold; 
        font-size: 16px;
        z-index: 2147483647; 
        transition: top 0.1s; 
        pointer-events: auto; 
        border-radius: 0 0 8px 8px;
        text-decoration: none; 
        box-shadow: 0 0 15px rgba(0,0,0,0.5);
        display: block !important;
      }
      
      #u1-wizard-skiplinks-wrapper a:focus { 
        top: 0; 
        outline: 3px solid #fff !important; 
        outline-offset: -3px; 
      }
    ');

    // Cache-busting note: bump U1W_VERSION (top of file) whenever any plugin
    // JS/CSS changes — a static version lets browsers/CDNs actually cache these.
    // 4. Runtime
    wp_enqueue_script('u1-runtime', $plugin_url . 'u1-runtime.js', ['u1-external-engine'], U1W_VERSION, true);
    wp_localize_script('u1-runtime', 'U1_SETTINGS', $cfg);

    // 5. Wizard
    if ($this->is_wizard_mode()) {
      wp_enqueue_style('u1-wizard', $plugin_url . 'u1-wizard.css', [], U1W_VERSION);
      wp_enqueue_script('u1-wizard-core', $plugin_url . 'js/u1-wizard-core.js', ['u1-runtime'], U1W_VERSION, true);

      wp_localize_script('u1-wizard-core', 'U1_WIZARD', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('u1_wizard_nonce'),
        'config' => $cfg,
      ]);

      $steps = ['init', 'components', 'skiplinks', 'scan'];
      foreach ($steps as $step) {
          wp_enqueue_script("u1-step-$step", $plugin_url . "js/u1-step-$step.js", ['u1-wizard-core'], U1W_VERSION, true);
      }
    }
  }

  public function add_admin_bar_link($wp_admin_bar) {
    if (!is_user_logged_in() || !current_user_can('manage_options')) return;
    if (is_admin()) return;
    $url = add_query_arg(['u1wizard' => '1'], (is_ssl() ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
    $wp_admin_bar->add_node(['id' => 'u1-wizard', 'title' => 'U1 Wizard', 'href' => esc_url($url)]);
  }

  public function ajax_save_config() {
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'forbidden'], 403);
    $raw = json_decode(wp_unslash($_POST['config']), true);
    update_option($this->option_name, $raw);
    wp_send_json_success(['ok' => true, 'config' => $raw]);
  }
}

new U1_Accessibility_Wizard();