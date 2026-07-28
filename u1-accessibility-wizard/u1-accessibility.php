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

  public function ajax_get_config() {
    if (!check_ajax_referer('u1_wizard_nonce', 'nonce', false)) wp_send_json_error(['message' => 'bad_nonce'], 403);
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'forbidden'], 403);
    wp_send_json_success(['config' => get_option($this->option_name, $this->get_default_config())]);
  }

  public function ajax_save_config() {
    // Both checks matter: the capability check stops non-admins, the nonce stops
    // an attacker from riding a logged-in admin's session. Without the nonce a
    // single cross-site POST rewrites the config, and the config is executed as
    // setAttribute() calls on every front-end visitor.
    if (!check_ajax_referer('u1_wizard_nonce', 'nonce', false)) wp_send_json_error(['message' => 'bad_nonce'], 403);
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'forbidden'], 403);

    if (!isset($_POST['config'])) wp_send_json_error(['message' => 'missing_config'], 400);
    $raw = json_decode(wp_unslash($_POST['config']), true);
    if (!is_array($raw)) wp_send_json_error(['message' => 'bad_config'], 400);

    $clean = $this->sanitize_config($raw);
    update_option($this->option_name, $clean);
    wp_send_json_success(['ok' => true, 'config' => $clean]);
  }

  /** Attributes u1-runtime.js must never be told to write. */
  private static $forbidden_attrs = ['style', 'href', 'src', 'srcdoc', 'formaction', 'action', 'data', 'xlink:href'];

  private function is_safe_attr($attr) {
    if (!is_string($attr) || $attr === '') return false;
    if (!preg_match('/^[a-zA-Z][a-zA-Z0-9:_-]*$/', $attr)) return false;
    $lower = strtolower($attr);
    if (strpos($lower, 'on') === 0) return false; // onclick, onerror, …
    return !in_array($lower, self::$forbidden_attrs, true);
  }

  private function clean_scalar($v) {
    if (is_bool($v) || is_int($v) || is_float($v) || is_null($v)) return $v;
    return sanitize_text_field((string) $v);
  }

  /**
   * Component entries are passed straight to window.u1.fix.*, whose field names
   * vary per component and change with the upstream library — so entries are
   * validated by shape (flat map of scalars, sane key names) rather than by an
   * exact key list that would silently drop legitimate new fields.
   */
  private function sanitize_entry($entry) {
    if (!is_array($entry)) return null;
    $out = [];
    foreach ($entry as $k => $v) {
      if (!is_string($k) || !preg_match('/^[a-zA-Z_][a-zA-Z0-9_-]*$/', $k)) continue;
      if (is_array($v)) continue; // no nested structures anywhere in the schema
      $out[$k] = $this->clean_scalar($v);
    }
    return $out ? $out : null;
  }

  private function sanitize_list($list, $extra = null) {
    if (!is_array($list)) return [];
    $out = [];
    foreach ($list as $entry) {
      $clean = $this->sanitize_entry($entry);
      if ($clean === null) continue;
      if ($extra && ($clean = call_user_func($extra, $clean)) === null) continue;
      $out[] = $clean;
    }
    return $out;
  }

  private function sanitize_config($raw) {
    $defaults = $this->get_default_config();
    $out = [];

    $init = isset($raw['init']) && is_array($raw['init']) ? $raw['init'] : [];
    $out['init'] = [
      'js_url'  => isset($init['js_url'])  ? esc_url_raw((string) $init['js_url'], ['http', 'https'])  : $defaults['init']['js_url'],
      'css_url' => isset($init['css_url']) ? esc_url_raw((string) $init['css_url'], ['http', 'https']) : $defaults['init']['css_url'],
      'focus_color'           => $this->clean_color($init['focus_color']           ?? null, $defaults['init']['focus_color']),
      'focus_secondary_color' => $this->clean_color($init['focus_secondary_color'] ?? null, $defaults['init']['focus_secondary_color']),
      'focus_double'      => !empty($init['focus_double']),
      'skiplinks_enabled' => !empty($init['skiplinks_enabled']),
    ];

    $out['skiplinks'] = $this->sanitize_list($raw['skiplinks'] ?? []);

    // The one place a stored value becomes a DOM attribute — hence the allow-list.
    $out['static_fixes'] = $this->sanitize_list($raw['static_fixes'] ?? [], function ($fix) {
      if (empty($fix['selector']) || !$this->is_safe_attr($fix['attr'] ?? '')) return null;
      return $fix;
    });

    foreach (['button', 'link', 'menu', 'form', 'accordion', 'tabs', 'dialog', 'carousel'] as $group) {
      $out[$group] = $this->sanitize_list($raw[$group] ?? []);
    }

    $out['setup_complete'] = !empty($raw['setup_complete']);
    if (isset($raw['scan_schedule'])) $out['scan_schedule'] = sanitize_key((string) $raw['scan_schedule']);
    if (isset($raw['scan_email']))    $out['scan_email']    = sanitize_email((string) $raw['scan_email']);

    return $out;
  }

  private function clean_color($val, $fallback) {
    return (is_string($val) && preg_match('/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $val)) ? $val : $fallback;
  }
}

new U1_Accessibility_Wizard();