import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/ai_models.dart';
import '../data/ai_repository.dart';

/// Chat-style AI assistant screen (also the shell's AI tab).
class AIAssistantChatScreen extends ConsumerStatefulWidget {
  const AIAssistantChatScreen({super.key});

  @override
  ConsumerState<AIAssistantChatScreen> createState() => _AIAssistantChatScreenState();
}

class _AIAssistantChatScreenState extends ConsumerState<AIAssistantChatScreen> {
  final _controller = TextEditingController();
  final _messages = <ChatMessageModel>[
    const ChatMessageModel(
      role: 'assistant',
      text: 'Namaste! I\'m your ASHA assistant. Ask me about anaemia, BP, immunization, breastfeeding, or referrals.',
    ),
  ];
  bool _sending = false;

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() {
      _messages.add(ChatMessageModel(
        role: 'user',
        text: text,
        timestamp: DateTime.now().toIso8601String(),
      ));
      _sending = true;
      _controller.clear();
    });
    final reply = await ref.read(aiRepositoryProvider).chat(text);
    if (!mounted) return;
    setState(() {
      _messages.add(ChatMessageModel(
        role: 'assistant',
        text: reply,
        timestamp: DateTime.now().toIso8601String(),
      ));
      _sending = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'AI Assistant',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('AI suggestions are for decision support. Always follow protocol.')),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(ASHASpacing.marginMobile),
                itemCount: _messages.length,
                itemBuilder: (context, i) {
                  final m = _messages[i];
                  final isUser = m.role == 'user';
                  return Align(
                    alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      constraints: const BoxConstraints(maxWidth: 320),
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isUser ? ASHAColors.primary : ASHAColors.primaryContainer,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        m.text,
                        style: ASHATypography.bodyMD.copyWith(
                          color: isUser ? ASHAColors.onPrimary : ASHAColors.onPrimaryContainer,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            if (_sending)
              const Padding(
                padding: EdgeInsets.all(8),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            Padding(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () async {
                      final text = await context.pushNamed<String>(AppRoutes.voiceInput);
                      if (text != null && text.isNotEmpty) {
                        _controller.text = text;
                        _send();
                      }
                    },
                    icon: const Icon(Icons.mic, color: ASHAColors.primary),
                    tooltip: 'Voice input',
                  ),
                  Expanded(
                    child: ASHATextField(
                      label: 'Ask anything',
                      hint: 'Type your question…',
                      controller: _controller,
                    ),
                  ),
                  const SizedBox(width: 8),
                  ASHAButton(
                    label: 'Send',
                    height: 48,
                    onPressed: _send,
                    icon: Icons.send,
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 64,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: ASHASpacing.marginMobile),
                children: [
                  _QuickChip('Maternal Risk', AppRoutes.maternalRisk),
                  _QuickChip('Child Growth', AppRoutes.childGrowth),
                  _QuickChip('NCD Risk', AppRoutes.ncdRisk),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickChip extends StatelessWidget {
  const _QuickChip(this.label, this.route);

  final String label;
  final String route;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        onPressed: () => context.pushNamed(route),
        avatar: const Icon(Icons.auto_awesome, size: 16, color: ASHAColors.primary),
        label: Text(label),
        backgroundColor: ASHAColors.primaryContainer,
        side: const BorderSide(color: ASHAColors.outlineVariant),
      ),
    );
  }
}
